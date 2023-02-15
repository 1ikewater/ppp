export function getInstrumentPrecision(instrument) {
  if (!instrument) return 0;

  const [dec, frac] = (instrument.minPriceIncrement ?? 0.01)
    .toString()
    .split('.');

  return frac ? frac.length : 0;
}

export function getInstrumentQuantityPrecision(instrument) {
  if (!instrument) return 0;

  const [dec, frac] = (instrument.minQuantityIncrement ?? 0)
    .toString()
    .split('.');

  return frac ? frac.length : 0;
}

export function formatDateWithOptions(date, options = {}) {
  if (!date) return '—';

  return new Intl.DateTimeFormat(
    'ru-RU',
    Object.assign(
      {
        hour12: false
      },
      options
    )
  ).format(new Date(date));
}

export function formatDate(date) {
  if (!date) return '—';

  return new Intl.DateTimeFormat('ru-RU', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  }).format(new Date(date));
}

export function formatPrice(price, instrument) {
  if (!instrument || typeof price !== 'number' || isNaN(price)) return '—';

  if (!instrument.currency) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: instrument.currency,
    minimumFractionDigits: getInstrumentPrecision(instrument)
  }).format(price);
}

export function formatCommission(commission, instrument) {
  if (!instrument || typeof commission !== 'number' || isNaN(commission))
    return '—';

  if (!instrument.currency) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: instrument.currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  }).format(commission);
}

export function formatPriceWithoutCurrency(price, instrument) {
  if (!instrument || typeof price !== 'number' || isNaN(price)) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: getInstrumentPrecision(instrument)
  }).format(price);
}

export function formatAmount(amount, currency) {
  if (!currency || typeof amount !== 'number' || isNaN(amount)) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency
  }).format(amount);
}

export function formatAbsoluteChange(price, instrument) {
  if (!instrument || typeof price !== 'number' || isNaN(price)) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: getInstrumentPrecision(instrument),
    signDisplay: 'always'
  }).format(price);
}

export function formatRelativeChange(change) {
  if (typeof change !== 'number' || isNaN(change)) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: 'always'
  }).format(change);
}

export function formatPercentage(change) {
  if (typeof change !== 'number' || isNaN(change)) return '—';

  return new Intl.NumberFormat('ru-RU', {
    style: 'percent',
    maximumFractionDigits: 3
  }).format(change);
}

export function formatQuantity(quantity, instrument) {
  if (typeof quantity !== 'number' || isNaN(quantity)) return '—';

  let precision = 0;

  if (typeof instrument?.minQuantityIncrement === 'number') {
    const [_, frac] = instrument.minQuantityIncrement.toString().split('.');

    precision = frac.length;
  }

  return new Intl.NumberFormat('ru-RU', {
    style: 'decimal',
    minimumFractionDigits: precision,
    maximumFractionDigits: precision
  }).format(quantity);
}

export function cyrillicToLatin(text) {
  if (/^\p{Script=Cyrillic}+$/u.test(text)) {
    const EN = 'QWERTYUIOP{}ASDFGHJKL:"ZXCVBNM<>~';
    const RU = 'ЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮЁ';
    const map = {};

    for (let i = 0; i < RU.length; i++) {
      map[RU[i]] = EN[i];
    }

    return text
      .split('')
      .map((l) => map[l.toUpperCase()])
      .join('');
  } else {
    return text;
  }
}

export function priceCurrencySymbol(instrument) {
  if (instrument?.type === 'future') return 'пт.';

  if (instrument?.type === 'cryptocurrency') return instrument.quoteCryptoAsset;

  if (instrument?.currency) {
    return (0)
      .toLocaleString('ru-RU', {
        style: 'currency',
        currency: instrument.currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      })
      .replace(/\d/g, '')
      .trim();
  } else return '';
}

export function currencyName(currencyCode) {
  if (!currencyCode) return '—';

  const currencyNames = new Intl.DisplayNames(['ru-RU'], { type: 'currency' });

  return currencyNames.of(currencyCode);
}

export function decimalSeparator() {
  const numberWithDecimalSeparator = 1.1;

  return Intl.NumberFormat('ru-RU')
    .formatToParts(numberWithDecimalSeparator)
    .find((part) => part.type === 'decimal').value;
}
