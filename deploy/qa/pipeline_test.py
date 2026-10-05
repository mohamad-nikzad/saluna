import hashlib
import json
import subprocess
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import pipeline


class PipelineSafetyTests(unittest.TestCase):
    def test_plan_includes_changes_before_a_later_documentation_push(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            repo = root / 'repo'
            repo.mkdir()
            subprocess.run(['git', 'init', '-q', str(repo)], check=True)
            def commit(name):
                subprocess.run(['git', 'add', '.'], cwd=repo, check=True)
                subprocess.run(['git', '-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-qm', name], cwd=repo, check=True)
                return subprocess.run(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True, capture_output=True, check=True).stdout.strip()
            (repo / 'README.md').write_text('baseline')
            base = commit('baseline')
            (repo / 'apps/api').mkdir(parents=True)
            (repo / 'apps/api/appointments.ts').write_text('changed behavior')
            commit('feature')
            (repo / 'README.md').write_text('docs only latest commit')
            head = commit('docs')
            (root / 'state').mkdir()
            (root / 'state/last-tested.json').write_text(json.dumps({'source_commit': base}))
            with patch.object(pipeline, 'ROOT', root):
                _, plan = pipeline.plan_for(head, repo)
            self.assertTrue(plan['required'])
            self.assertIn('apps/api/appointments.ts', plan['changed_files'])

    def test_disk_reserve_includes_expanded_images(self):
        metadata = {'archive_bytes': 1000, 'images_bytes': 100000}
        resources = {'available_memory_mb': 2000, 'free_disk_mb': 8000, 'load_1m': .1, 'cpu_count': 2}
        with patch.object(pipeline.control, 'headroom', return_value=resources), patch.object(pipeline.control, 'production_healthy', return_value=True), patch.object(pipeline.shutil, 'disk_usage') as disk:
            disk.return_value.free = 5 * 1024**3 + 50000
            with self.assertRaisesRegex(RuntimeError, 'insufficient_disk'):
                pipeline.preflight(metadata)

    def test_lost_wake_response_still_attempts_owned_cleanup(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'server'
            root.mkdir()
            folder = Path(tmp) / 'artifact'
            folder.mkdir()
            revision = 'qa-aaaaaaaa-bbbbbbbbbbbb'
            archive = folder / (revision + '.tar.gz')
            archive.write_bytes(b'fixture')
            metadata = {'revision': revision, 'source_commit': 'a' * 40, 'source_dirty': False, 'archive_sha256': hashlib.sha256(b'fixture').hexdigest(), 'archive_bytes': 7, 'images_bytes': 100}
            path = folder / (revision + '.json')
            path.write_text(json.dumps(metadata))
            calls = []
            def controller(action, data=None):
                calls.append((action, data))
                if action == 'wake':
                    raise RuntimeError('response lost after accepted wake')
                return {'state': 'asleep'}
            with patch.object(pipeline, 'ROOT', root), patch.object(pipeline, 'plan_for', return_value=('a' * 40, {'required': True})), patch.object(pipeline, 'preflight'), patch.object(pipeline, 'controller', side_effect=controller):
                with self.assertRaisesRegex(RuntimeError, 'response lost'):
                    pipeline.install(folder, Path(tmp), '123', '1')
            self.assertEqual(calls[-1], ('sleep', {'run_id': 'deploy-gh-123-1'}))
            self.assertFalse((root / archive.name).exists())


if __name__ == '__main__':
    unittest.main()
