// NSE trading hours: 09:15–15:30 IST, Mon–Fri.
// ponytail: no holiday list yet — weekday + time only. Add NSE holiday
// calendar (fetched yearly) when a real user notices a Republic Day
// showing as "open". For now the header disclaims possible skew.

type Status = { open: boolean; label: string; dateLabel: string }

export function nseStatus(now: Date = new Date()): Status {
  // Compute India Standard Time (UTC+5:30) from any wall clock.
  const istMs = now.getTime() + (5 * 60 + 30) * 60_000 + now.getTimezoneOffset() * 60_000
  const ist = new Date(istMs)

  const dow = ist.getUTCDay() // 0 Sun … 6 Sat
  const minutes = ist.getUTCHours() * 60 + ist.getUTCMinutes()
  const OPEN = 9 * 60 + 15
  const CLOSE = 15 * 60 + 30

  const isWeekday = dow >= 1 && dow <= 5
  const open = isWeekday && minutes >= OPEN && minutes < CLOSE

  const dateLabel = ist.toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  })

  let label: string
  if (!isWeekday) label = 'Closed — weekend'
  else if (minutes < OPEN) label = 'Opens 09:15 IST'
  else if (minutes >= CLOSE) label = 'Closed for the day'
  else label = 'Open · NSE'

  return { open, label, dateLabel }
}

// self-check: `node --experimental-strip-types src/lib/marketStatus.ts`
// or `VERIDEX_SELFCHECK=1 npx tsx src/lib/marketStatus.ts`
declare const process: { env: Record<string, string | undefined> } | undefined
if (typeof process !== 'undefined' && process.env?.VERIDEX_SELFCHECK) {
  const openWed = nseStatus(new Date(Date.UTC(2026, 5, 3, 4, 45)))    // Wed 10:15 IST
  const openSat = nseStatus(new Date(Date.UTC(2026, 5, 6, 4, 45)))    // Sat
  const openLate = nseStatus(new Date(Date.UTC(2026, 5, 3, 10, 30)))  // Wed 16:00 IST
  console.assert(openWed.open,  'wed 10:15 IST should be open')
  console.assert(!openSat.open, 'sat should be closed')
  console.assert(!openLate.open,'after 15:30 IST should be closed')
  console.log('marketStatus self-check ok')
}
