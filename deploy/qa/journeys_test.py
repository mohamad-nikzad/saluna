import unittest
import journeys


class JourneySelectionTests(unittest.TestCase):
    def test_documentation_does_not_wake_staging(self):
        self.assertFalse(journeys.select(['docs/adr/010.md', 'backlog/INDEX.md'])['required'])

    def test_staff_privacy_covers_related_client_and_assignment_journeys(self):
        areas = {j['area'] for j in journeys.select(['apps/api/src/routes/appointments.ts', 'packages/auth/src/tenant.ts'])['journeys']}
        self.assertTrue({'appointment', 'client', 'team', 'catalog', 'public', 'commission'} <= areas)

    def test_shared_ui_has_broad_coverage_and_visual_review(self):
        plan = journeys.select(['packages/ui/src/dialog.tsx'])
        self.assertGreaterEqual(len(plan['journeys']), 6)
        self.assertTrue(any('RTL' in item for item in plan['review']))

    def test_admin_is_explicitly_uncovered(self):
        self.assertTrue(journeys.select(['apps/admin/src/page.tsx'])['coverage_gaps'])


if __name__ == '__main__':
    unittest.main()
