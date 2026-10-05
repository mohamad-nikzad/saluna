import json
import tempfile
import time
import unittest
from pathlib import Path
from unittest.mock import patch

import update_server


class ExistingReleaseTests(unittest.TestCase):
    def test_brief_load_tail_waits_for_the_same_guard(self):
        session = {'run_id': 'retry', 'state': 'awake', 'deadline': time.time() + 1000}
        with patch.object(update_server.control, 'read_state', return_value=session), patch.object(update_server.control, 'headroom'), patch.object(update_server.control, 'pressure_reason', side_effect=['host_busy', None]), patch.object(update_server.control, 'production_healthy', return_value=True), patch.object(update_server.time, 'sleep') as sleep:
            update_server.check_lease('retry')
        sleep.assert_called_once_with(5)

    def test_lost_lease_during_cooldown_cannot_continue(self):
        session = {'run_id': 'retry', 'state': 'awake', 'deadline': time.time() + 1000}
        with patch.object(update_server.control, 'read_state', side_effect=[session, {'state': 'asleep'}]), patch.object(update_server.control, 'headroom'), patch.object(update_server.control, 'pressure_reason', return_value='host_busy'), patch.object(update_server.control, 'production_healthy', return_value=True), patch.object(update_server.time, 'sleep'):
            with self.assertRaisesRegex(RuntimeError, 'lease'):
                update_server.check_lease('retry')

    def test_persistent_load_still_refuses_without_extending_the_lease(self):
        session = {'run_id': 'retry', 'state': 'awake', 'deadline': time.time() + 1000}
        deadline = session['deadline']
        with patch.object(update_server.control, 'read_state', return_value=session), patch.object(update_server.control, 'headroom'), patch.object(update_server.control, 'pressure_reason', return_value='host_busy'), patch.object(update_server.control, 'production_healthy', return_value=True), patch.object(update_server.time, 'sleep') as sleep:
            with self.assertRaisesRegex(RuntimeError, 'host_busy'):
                update_server.check_lease('retry')
        self.assertEqual(sleep.call_count, 6)
        self.assertEqual(session['deadline'], deadline)

    def test_retry_existing_revision_keeps_qa_data_and_reaches_readiness(self):
        revision = 'qa-aaaaaaaa-bbbbbbbbbbbb'
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'state').mkdir()
            env = 'QA_REVISION=' + revision + '\nDATABASE_URL=postgresql://saluna_qa:fixture@postgres/saluna_qa\nDATABASE_URL_DIRECT=postgresql://saluna_qa:fixture@postgres/saluna_qa\nSALUNA_ENVIRONMENT=qa\nSMS_ENABLED=false\nBALE_ENABLED=false\nBALE_SAFIR_ENABLED=false\nTELEGRAM_ENABLED=false\n'
            (root / '.env.qa.local').write_text(env)
            (root / (revision + '.json')).write_text(json.dumps({'revision': revision}))
            (root / (revision + '.tar.gz')).write_bytes(b'fixture')
            (root / 'existing-qa-data').write_text('keep')
            session = {'run_id': 'retry', 'state': 'awake', 'deadline': time.time() + 1000}
            with patch.object(update_server, 'Path', side_effect=lambda _: root), patch.object(update_server.control, 'read_state', return_value=session), patch.object(update_server.control, 'headroom'), patch.object(update_server.control, 'pressure_reason', return_value=None), patch.object(update_server.control, 'production_healthy', return_value=True), patch.object(update_server.control, 'command') as command:
                update_server.main(revision, 'retry')
            self.assertEqual((root / '.env.qa.local').read_text(), env)
            self.assertEqual((root / 'existing-qa-data').read_text(), 'keep')
            self.assertEqual(json.loads((root / 'state/deployment.json').read_text())['revision'], revision)
            self.assertTrue(any('migrate.cjs' in call.args[0] for call in command.call_args_list))
            self.assertEqual(command.call_args.args[0][-5:], update_server.control.SERVICES)

    def test_production_target_is_refused_before_any_docker_command(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / '.env.qa.local').write_text('DATABASE_URL=postgresql://production:fixture@postgres/production\n')
            with patch.object(update_server, 'Path', side_effect=lambda _: root), patch.object(update_server.control, 'command') as command:
                with self.assertRaisesRegex(SystemExit, 'isolated saluna_qa'):
                    update_server.main('qa-aaaaaaaa-bbbbbbbbbbbb', 'retry')
                command.assert_not_called()


if __name__ == '__main__':
    unittest.main()
