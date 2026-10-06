"""One synthetic customer request, owner approval, staff view, and tenant check.

Run only during an authenticated QA session. Never uses production hosts.
"""
import base64
import argparse
import datetime
import http.cookiejar
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
from pathlib import Path
from network import opener as network_opener

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--staff-privacy', action='store_true')
parser.add_argument('--access-file', type=Path, default=Path('.codex/qa/qa-access.local.json'))
parser.add_argument('--local-gateway', action='store_true', help='Use only the VPS loopback gateway, with the staging Host')
args = parser.parse_args()
def opener(*handlers):
    return network_opener(*handlers, local_gateway=args.local_gateway)
access = json.loads(args.access_file.read_text())
ROOT = 'https://staging-app.saluna.ir'
basic = base64.b64encode(f"{access['gateway_username']}:{access['gateway_password']}".encode()).decode()
headers = {'Authorization': 'Basic ' + basic, 'Content-Type': 'application/json', 'Origin': ROOT}


def request(browser, path, body=None, method=None):
    req = urllib.request.Request(ROOT + path, headers=headers, data=json.dumps(body).encode() if body is not None else None, method=method)
    for attempt in range(2):
        try:
            with browser.open(req, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            # Authentication remains rate limited, including in QA. Retry only
            # a refused sign-in, once, after its advertised cooldown.
            if error.code == 429 and path == '/api/v1/auth/sign-in/username' and attempt == 0:
                try:
                    delay = int(error.headers.get('Retry-After') or error.headers.get('X-Retry-After', '0'))
                except ValueError:
                    delay = 0
                if 0 < delay <= 60:
                    print('QA sign-in cooldown:', delay, 'seconds', flush=True)
                    time.sleep(delay + 1)
                    continue
            # Never print auth responses, session cookies, or confirmation tokens.
            safe_path = re.sub(r'[0-9a-f]{8}-[0-9a-f-]{27,}', '[id]', path.split('?')[0])
            safe_path = re.sub(r'(/appointment-requests/)[^/]+', r'\1[id]', safe_path)
            raise RuntimeError(f'{req.get_method()} {safe_path} returned {error.code}') from None


def login(phone):
    browser = opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    result = request(browser, '/api/v1/auth/sign-in/username', {'username': phone, 'password': access['test_password']})
    assert result.get('user'), 'Login did not return a user'
    me = request(browser, '/api/v1/auth/me')
    assert me['status'] == 'ready', 'Seed account is not ready'
    return browser, me['user']


owner, owner_user = login(access['owner_phone'])
staff, staff_user = login(access['staff_phone'])
staff_profile_id = staff_user.get('staffProfileId') or staff_user['id']
other, other_user = login(access['secondary_owner_phone'])
assert owner_user['role'] == 'manager' and staff_user['role'] == 'staff'
assert owner_user['salonId'] == staff_user['salonId'] != other_user['salonId']
print('PASS owner, staff, and second salon logins')

customer = opener()
salon = request(customer, '/api/v1/public/salons/saluna')
assert salon['salon']['id'] == owner_user['salonId'], 'Public host did not reach the seeded QA salon'
service = min((s for s in salon['services'] if s['id'] in staff_user['serviceIds']), key=lambda s: s['duration'])
date = (datetime.date.today() + datetime.timedelta(days=3)).isoformat()
query = urllib.parse.urlencode({'serviceId': service['id'], 'date': date, 'mode': 'day'})
slots = request(customer, '/api/v1/public/salons/saluna/availability?' + query)['slots']
slot = next(s for s in slots if s['staffId'] == staff_profile_id)
run_name = 'QA setup ' + uuid.uuid4().hex[:12]
token = None
appointment_id = None
try:
    token = request(customer, '/api/v1/public/salons/saluna/appointment-requests', {
        'serviceId': service['id'], 'date': slot['date'], 'startTime': slot['startTime'], 'endTime': slot['endTime'],
        'customerName': run_name, 'customerPhone': access['customer_phone'], 'notes': run_name,
    })['token']
    requests = request(owner, '/api/v1/appointment-requests?status=pending')['requests']
    pending = next(r for r in requests if r['customerName'] == run_name)
    approval = request(owner, '/api/v1/appointment-requests/' + pending['id'] + '/approve', {
        'staffAssignments': [{'staffId': staff_profile_id, 'isLead': True, 'allocationBasisPoints': 10000}],
    })
    appointment_id = approval['appointmentId']
    path = '/api/v1/appointments?' + urllib.parse.urlencode({'startDate': date, 'endDate': date})
    visible = request(staff, path)['appointments']
    assert any(a['id'] == appointment_id for a in visible), 'Assigned staff cannot see the approved appointment'
    isolated = request(other, path)['appointments']
    assert not any(a['id'] == appointment_id for a in isolated), 'Appointment leaked to the second salon'
    status = request(customer, '/api/v1/public/salons/saluna/appointment-requests/' + token)
    assert status['status'] == 'approved'
    print('PASS customer request, owner approval, staff calendar, and second salon isolation')
    print('Created QA appointment', appointment_id)
    if args.staff_privacy:
        detail_path = '/api/v1/appointments/' + appointment_id
        assigned = next(a for a in visible if a['id'] == appointment_id)
        detail = request(staff, detail_path)['appointment']
        for view in (assigned, detail):
            assert set(view['client']) <= {'id', 'name', 'isPlaceholder'}, 'Private Client fields leaked to staff'
        manager_detail = request(owner, detail_path)['appointment']
        assert manager_detail['client']['phone'] == access['customer_phone'], 'Manager lost Client contact access'
        # Exact 403 verifies permission refusal, rather than accepting any server error.
        for path, body in [(detail_path, {'status': 'cancelled'}), (detail_path, {'status': 'confirmed', 'finalPrice': 123})]:
            req = urllib.request.Request(ROOT + path, headers=headers, data=json.dumps(body).encode(), method='PATCH')
            try:
                staff.open(req, timeout=30)
                raise AssertionError('Staff changed manager-only fields')
            except urllib.error.HTTPError as error:
                assert error.code == 403, 'Unexpected staff permission response'
        unassigned, _ = login('09120000002')
        try:
            unassigned.open(urllib.request.Request(ROOT + detail_path, headers=headers), timeout=30)
            raise AssertionError('Unassigned staff could read the Appointment')
        except urllib.error.HTTPError as error:
            assert error.code == 403
        completed = request(staff, detail_path, {'status': 'completed'}, method='PATCH')['appointment']
        assert completed['status'] == 'completed'
        assert set(completed['client']) <= {'id', 'name', 'isPlaceholder'}
        history = request(owner, detail_path)['appointment']['statusHistory']
        assert any(h['newStatus'] == 'completed' and h['actorUserId'] == staff_user['id'] for h in history), 'Staff transition was not attributed'
        print('PASS staff Client privacy, manager contact access, forbidden writes, unassigned access, lead completion, and manager status history')
finally:
    if appointment_id:
        request(owner, '/api/v1/appointments/' + appointment_id, {'status': 'cancelled'}, method='PATCH')
        print('PASS cancelled only this run\'s appointment')
    elif token:
        request(customer, '/api/v1/public/salons/saluna/appointment-requests/' + token + '/cancel', {})
        print('Cancelled only this run\'s pending request')
