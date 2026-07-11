export type IconName =
  | 'sparkles'
  | 'calendar-days'
  | 'users-round'
  | 'user-plus'
  | 'scissors'
  | 'chart-no-axes-combined'
  | 'bell-ring'
  | 'wallet'

type IconElement =
  | ['path', { d: string }]
  | ['circle', { cx: string; cy: string; r: string }]
  | [
      'rect',
      { width: string; height: string; x: string; y: string; rx?: string },
    ]
  | ['line', { x1: string; x2: string; y1: string; y2: string }]

export const icons: Record<IconName, IconElement[]> = {
  sparkles: [
    [
      'path',
      {
        d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z',
      },
    ],
    ['path', { d: 'M20 2v4' }],
    ['path', { d: 'M22 4h-4' }],
    ['circle', { cx: '4', cy: '20', r: '2' }],
  ],
  'calendar-days': [
    ['path', { d: 'M8 2v4' }],
    ['path', { d: 'M16 2v4' }],
    ['rect', { width: '18', height: '18', x: '3', y: '4', rx: '2' }],
    ['path', { d: 'M3 10h18' }],
    ['path', { d: 'M8 14h.01' }],
    ['path', { d: 'M12 14h.01' }],
    ['path', { d: 'M16 14h.01' }],
    ['path', { d: 'M8 18h.01' }],
    ['path', { d: 'M12 18h.01' }],
    ['path', { d: 'M16 18h.01' }],
  ],
  'users-round': [
    ['path', { d: 'M18 21a8 8 0 0 0-16 0' }],
    ['circle', { cx: '10', cy: '8', r: '5' }],
    ['path', { d: 'M22 20c0-3.37-2-6.5-4-8a5 5 0 0 0-.45-8.3' }],
  ],
  'user-plus': [
    ['path', { d: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2' }],
    ['circle', { cx: '9', cy: '7', r: '4' }],
    ['line', { x1: '19', x2: '19', y1: '8', y2: '14' }],
    ['line', { x1: '22', x2: '16', y1: '11', y2: '11' }],
  ],
  scissors: [
    ['circle', { cx: '6', cy: '6', r: '3' }],
    ['path', { d: 'M8.12 8.12 12 12' }],
    ['path', { d: 'M20 4 8.12 15.88' }],
    ['circle', { cx: '6', cy: '18', r: '3' }],
    ['path', { d: 'M14.8 14.8 20 20' }],
  ],
  'chart-no-axes-combined': [
    ['path', { d: 'M12 16v5' }],
    ['path', { d: 'M16 14v7' }],
    ['path', { d: 'M20 10v11' }],
    [
      'path',
      {
        d: 'm22 3-8.646 8.646a.5.5 0 0 1-.708 0L9.354 8.354a.5.5 0 0 0-.707 0L2 15',
      },
    ],
    ['path', { d: 'M4 18v3' }],
    ['path', { d: 'M8 14v7' }],
  ],
  'bell-ring': [
    ['path', { d: 'M10.268 21a2 2 0 0 0 3.464 0' }],
    ['path', { d: 'M22 8c0-2.3-.8-4.3-2-6' }],
    [
      'path',
      {
        d: 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326',
      },
    ],
    ['path', { d: 'M4 2C2.8 3.7 2 5.7 2 8' }],
  ],
  wallet: [
    [
      'path',
      {
        d: 'M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1',
      },
    ],
    ['path', { d: 'M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4' }],
  ],
}
