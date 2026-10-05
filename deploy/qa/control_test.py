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
        self.resources = {'available_memory_mb': 2400, 'free_disk_mb': 9000, 'load_1m': 0.2, 'cpu_count': 2}

    def tearDown(self):
        self.state.stop()
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


if __name__ == '__main__':
    unittest.main()
