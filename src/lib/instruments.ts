// Curated Nifty-heavyweights instrument keys for Upstox.
// ponytail: hardcoded 30 tickers for the demo. Full universe = fetch
// Upstox's instrument CSV once daily and cache in a Supabase table.
// Do that when a user actually asks for a stock not on this list.

export type Instrument = {
  symbol: string       // display ticker (RELIANCE)
  name:   string       // display name (Reliance Industries)
  sector: string
  key:    string       // Upstox instrument key (NSE_EQ|ISIN)
  exchange: 'NSE'
}

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'RELIANCE',   name: 'Reliance Industries',     sector: 'Energy',      key: 'NSE_EQ|INE002A01018', exchange: 'NSE' },
  { symbol: 'TCS',        name: 'Tata Consultancy',        sector: 'IT',          key: 'NSE_EQ|INE467B01029', exchange: 'NSE' },
  { symbol: 'HDFCBANK',   name: 'HDFC Bank',               sector: 'Financials',  key: 'NSE_EQ|INE040A01034', exchange: 'NSE' },
  { symbol: 'INFY',       name: 'Infosys',                 sector: 'IT',          key: 'NSE_EQ|INE009A01021', exchange: 'NSE' },
  { symbol: 'ICICIBANK',  name: 'ICICI Bank',              sector: 'Financials',  key: 'NSE_EQ|INE090A01021', exchange: 'NSE' },
  { symbol: 'HINDUNILVR', name: 'Hindustan Unilever',      sector: 'FMCG',        key: 'NSE_EQ|INE030A01027', exchange: 'NSE' },
  { symbol: 'ITC',        name: 'ITC',                     sector: 'FMCG',        key: 'NSE_EQ|INE154A01025', exchange: 'NSE' },
  { symbol: 'SBIN',       name: 'State Bank of India',     sector: 'Financials',  key: 'NSE_EQ|INE062A01020', exchange: 'NSE' },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel',           sector: 'Telecom',     key: 'NSE_EQ|INE397D01024', exchange: 'NSE' },
  { symbol: 'KOTAKBANK',  name: 'Kotak Mahindra Bank',     sector: 'Financials',  key: 'NSE_EQ|INE237A01028', exchange: 'NSE' },
  { symbol: 'LT',         name: 'Larsen & Toubro',         sector: 'Construction',key: 'NSE_EQ|INE018A01030', exchange: 'NSE' },
  { symbol: 'AXISBANK',   name: 'Axis Bank',               sector: 'Financials',  key: 'NSE_EQ|INE238A01034', exchange: 'NSE' },
  { symbol: 'ASIANPAINT', name: 'Asian Paints',            sector: 'Consumer',    key: 'NSE_EQ|INE021A01026', exchange: 'NSE' },
  { symbol: 'MARUTI',     name: 'Maruti Suzuki',           sector: 'Auto',        key: 'NSE_EQ|INE585B01010', exchange: 'NSE' },
  { symbol: 'BAJFINANCE', name: 'Bajaj Finance',           sector: 'Financials',  key: 'NSE_EQ|INE296A01024', exchange: 'NSE' },
  { symbol: 'TITAN',      name: 'Titan Company',           sector: 'Consumer',    key: 'NSE_EQ|INE280A01028', exchange: 'NSE' },
  { symbol: 'SUNPHARMA',  name: 'Sun Pharmaceutical',      sector: 'Pharma',      key: 'NSE_EQ|INE044A01036', exchange: 'NSE' },
  { symbol: 'NESTLEIND',  name: 'Nestle India',            sector: 'FMCG',        key: 'NSE_EQ|INE239A01024', exchange: 'NSE' },
  { symbol: 'WIPRO',      name: 'Wipro',                   sector: 'IT',          key: 'NSE_EQ|INE075A01022', exchange: 'NSE' },
  { symbol: 'ULTRACEMCO', name: 'UltraTech Cement',        sector: 'Cement',      key: 'NSE_EQ|INE481G01011', exchange: 'NSE' },
  { symbol: 'HCLTECH',    name: 'HCL Technologies',        sector: 'IT',          key: 'NSE_EQ|INE860A01027', exchange: 'NSE' },
  { symbol: 'M&M',        name: 'Mahindra & Mahindra',     sector: 'Auto',        key: 'NSE_EQ|INE101A01026', exchange: 'NSE' },
  { symbol: 'ADANIENT',   name: 'Adani Enterprises',       sector: 'Conglomerate',key: 'NSE_EQ|INE423A01024', exchange: 'NSE' },
  { symbol: 'NTPC',       name: 'NTPC',                    sector: 'Power',       key: 'NSE_EQ|INE733E01010', exchange: 'NSE' },
  { symbol: 'POWERGRID',  name: 'Power Grid',              sector: 'Power',       key: 'NSE_EQ|INE752E01010', exchange: 'NSE' },
  { symbol: 'TATAMOTORS', name: 'Tata Motors',             sector: 'Auto',        key: 'NSE_EQ|INE155A01022', exchange: 'NSE' },
  { symbol: 'TATASTEEL',  name: 'Tata Steel',              sector: 'Metals',      key: 'NSE_EQ|INE081A01020', exchange: 'NSE' },
  { symbol: 'ONGC',       name: 'Oil and Natural Gas',     sector: 'Energy',      key: 'NSE_EQ|INE213A01029', exchange: 'NSE' },
  { symbol: 'JSWSTEEL',   name: 'JSW Steel',               sector: 'Metals',      key: 'NSE_EQ|INE019A01038', exchange: 'NSE' },
  { symbol: 'COALINDIA',  name: 'Coal India',              sector: 'Energy',      key: 'NSE_EQ|INE522F01014', exchange: 'NSE' },
]

export const bySymbol = (sym: string) =>
  INSTRUMENTS.find((i) => i.symbol.toUpperCase() === sym.toUpperCase())

export const byKey = (key: string) =>
  INSTRUMENTS.find((i) => i.key === key)
