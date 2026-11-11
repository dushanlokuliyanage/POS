export const formatMoney = (cents: number): string =>
  `Rs. ${(cents / 100).toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`