import importlib.util
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('qa_control', Path(__file__).with_name('control.py'))
control = importlib.util.module_from_spec(spec)
spec.loader.exec_module(control)


class ControlSafetyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.state = patch.object(control, 'STATE', Path(self.tmp.name) / 'session.json')
        self.state.start()
        self.root = patch.object(control, 'ROOT', Path(self.tmp.name))
        self.root.start()
        (Path(self.tmp.name) / '.env.qa.local').write_text('QA_SEED_PASSWORD=private-test-password\n')
        self.resources = {'available_memory_mb': 2400, 'free_disk_mb': 9000, 'load_1m': 0.2, 'cpu_count': 2}

    def tearDown(self):
        self.state.stop()
        self.root.stop()
        self.tmp.cleanup()

    def test_refuses_start_when_production_needs_memory(self):
        self.resources['available_memory_mb'] = 1600
        with patch.object(control, 'headroom', return_value=self.resources), patch.object(control, 'command') as command:
            with self.assertRaisesRegex(ValueError, 'insufficient_memory'):
                control.start('nightly')
            command.assert_not_called()

    def test_refuses_start_for_disk_and_cpu_pressure(self):
        for key, value, reason in [('free_disk_mb', 4000, 'insufficient_disk'), ('load_1m', 1.5, 'host_busy')]:
            resources = {**self.resources, key: value}
            self.assertEqual(control.pressure_reason(resources, starting=True), reason)

    def test_start_requires_healthy_production(self):
        with patch.object(control, 'headroom', return_value=self.resources), patch.object(control, 'production_healthy', return_value=False), patch.object(control, 'command') as command:
            with self.assertRaisesRegex(ValueError, 'production_unhealthy'):
                control.start('nightly')
            command.assert_not_called()

    def test_retry_does_not_extend_deadline(self):
        session = {'state': 'awake', 'run_id': 'nightly', 'deadline': 123}
        control.save_state(session)
        self.assertEqual(control.start('nightly'), session)
        with self.assertRaisesRegex(ValueError, 'another_qa_session'):
            control.start('other')

    def test_stop_failure_remains_due_for_retry(self):
        with patch.object(control, 'command', side_effect=RuntimeError('unavailable')):
            with self.assertRaises(RuntimeError):
                control.sleep('session_expired')
        self.assertEqual(control.read_state()['state'], 'stop_failed')
        self.assertEqual(control.read_state()['deadline'], 1)

    def test_cannot_wake_after_a_failed_stop(self):
        control.save_state({'state': 'stop_failed', 'deadline': 1})
        with patch.object(control, 'command') as command:
            with self.assertRaisesRegex(ValueError, 'qa_cleanup_required'):
                control.start('other')
            command.assert_not_called()

    def test_stop_only_targets_fixed_qa_services(self):
        with patch.object(control, 'command') as command:
            control.sleep('requested')
        args = command.call_args.args[0]
        self.assertIn('saluna-qa', args)
        self.assertEqual(args[-5:], control.SERVICES)
        self.assertEqual(control.read_state()['state'], 'asleep')

    def test_cleanup_cannot_stop_a_different_session(self):
        control.save_state({'state': 'awake', 'run_id': 'new', 'deadline': 123})
        with patch.object(control, 'command') as command:
            with self.assertRaisesRegex(ValueError, 'another_qa_session'):
                control.sleep('requested', 'old')
            command.assert_not_called()
        self.assertEqual(control.read_state()['run_id'], 'new')

    def test_compose_cannot_restore_a_stale_controller_revision(self):
        with patch.dict(control.os.environ, {'QA_REVISION': 'old', 'PATH': '/bin'}), patch.object(control.subprocess, 'run') as run:
            run.return_value.stdout = 'ok'
            self.assertEqual(control.command(control.COMPOSE + ['up', '-d']), 'ok')
        self.assertNotIn('QA_REVISION', run.call_args.kwargs['env'])
        self.assertEqual(run.call_args.kwargs['env']['PATH'], '/bin')

    def job(self):
        control.save_document('job.json', {'id': 'gh-123-1', 'revision': 'qa-test', 'source_commit': 'a' * 40, 'source_branch': 'main', 'source_dirty': False, 'plan': {'journeys': [{'area': 'appointment'}], 'coverage_gaps': []}})
        control.save_document('job-claim.json', {'job_id': 'gh-123-1', 'run_id': 'browser-1'})
        return {'job_id': 'gh-123-1', 'run_id': 'browser-1', 'revision': 'qa-test', 'outcome': 'pass', 'coverage': [{'area': 'appointment', 'status': 'pass', 'summary': 'Own request approved and cleaned up'}], 'issues': []}

    def test_job_wake_refuses_wrong_installed_revision(self):
        self.job()
        with patch.object(control, 'deployment', return_value={'revision': 'other'}), patch.object(control, 'command') as command:
            with self.assertRaisesRegex(ValueError, 'job_revision_not_installed'):
                control.start('browser-2', 'gh-123-1')
            command.assert_not_called()

    def test_report_requires_owned_job_and_verified_sleep(self):
        report = self.job()
        with patch.object(control, 'deployment', return_value={'revision': 'qa-test'}):
            with self.assertRaisesRegex(ValueError, 'report_does_not_own_job'):
                control.record_report({**report, 'run_id': 'other'})
            control.save_state({'state': 'awake'})
            with self.assertRaisesRegex(ValueError, 'sleep_before_reporting'):
                control.record_report(report)

    def test_successful_report_acknowledges_once_and_advances_baseline(self):
        report = self.job()
        with patch.object(control, 'deployment', return_value={'revision': 'qa-test'}):
            first = control.record_report(report)
            self.assertEqual(control.record_report(report), first)
            self.assertIsNone(control.pending_job())
        self.assertEqual(control.read_document('last-tested.json')['source_commit'], 'a' * 40)

    def test_partial_or_credential_report_cannot_claim_success(self):
        report = self.job()
        with patch.object(control, 'deployment', return_value={'revision': 'qa-test'}):
            with self.assertRaisesRegex(ValueError, 'report_missing_coverage'):
                control.record_report({**report, 'coverage': []})
            with self.assertRaisesRegex(ValueError, 'report_contains_credential'):
                control.record_report({**report, 'coverage': [{'area': 'appointment', 'status': 'pass', 'summary': 'private-test-password'}]})
        self.assertIsNone(control.read_document('last-tested.json'))

    def test_blocked_report_does_not_lose_untested_changes(self):
        report = self.job()
        report['outcome'] = 'blocked'
        report['coverage'][0]['status'] = 'blocked'
        with patch.object(control, 'deployment', return_value={'revision': 'qa-test'}):
            control.record_report(report)
        self.assertIsNone(control.read_document('last-tested.json'))

    def test_validation_branch_does_not_advance_main_baseline(self):
        report = self.job()
        job = control.read_document('job.json')
        job['source_branch'] = 'codex/qa-validation'
        control.save_document('job.json', job)
        with patch.object(control, 'deployment', return_value={'revision': 'qa-test'}):
            control.record_report(report)
        self.assertIsNone(control.read_document('last-tested.json'))


if __name__ == '__main__':
    unittest.main()
