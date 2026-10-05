import importlib.util
import subprocess
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location('qa_update', Path(__file__).with_name('update.py'))
update = importlib.util.module_from_spec(spec)
spec.loader.exec_module(update)


class ReleaseSnapshotTests(unittest.TestCase):
    def test_selected_revision_excludes_secrets_and_keeps_local_changes_separate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            source = root / 'repo'
            source.mkdir()
            subprocess.run(['git', 'init', '-q', str(source)], check=True)
            (source / '.gitignore').write_text('.env*\n.codex/\n')
            (source / 'product.ts').write_text('committed')
            subprocess.run(['git', 'add', '.'], cwd=source, check=True)
            subprocess.run(['git', '-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-qm', 'fixture'], cwd=source, check=True)
            (source / '.env.local').write_text('private token')
            (source / '.codex').mkdir()
            (source / '.codex/private.json').write_text('private access')
            (source / 'product.ts').write_text('uncommitted product change')
            (source / 'new-product.ts').write_text('new product change')
            clean = root / 'clean'
            clean.mkdir()
            update.snapshot(source, clean, 'HEAD', False)
            self.assertEqual((clean / 'product.ts').read_text(), 'committed')
            self.assertFalse((clean / 'new-product.ts').exists())
            working = root / 'working'
            working.mkdir()
            _, dirty = update.snapshot(source, working, 'HEAD', True)
            self.assertTrue(dirty)
            self.assertEqual((working / 'product.ts').read_text(), 'uncommitted product change')
            self.assertTrue((working / 'new-product.ts').exists())
            for snapshot in (clean, working):
                self.assertFalse((snapshot / '.env.local').exists())
                self.assertFalse((snapshot / '.codex').exists())
            self.assertEqual((source / 'product.ts').read_text(), 'uncommitted product change')
            old = update.source_digest(working)
            (working / 'product.ts').write_text('another product change')
            self.assertNotEqual(old, update.source_digest(working))


if __name__ == '__main__':
    unittest.main()
