from datetime import date, timedelta

def weekday_index_in_month(input_date: date) -> int:
    """
    Returns which occurrence of the weekday this date is in its month.
    Example:
        2024-02-17 (Saturday) -> 3  (3rd Saturday of Feb 2024)
    """
    weekday = input_date.weekday()  # Monday=0, Sunday=6
    first_day = input_date.replace(day=1)

    count = 0
    current = first_day

    while current <= input_date:
        if current.weekday() == weekday:
            count += 1
        current += timedelta(days=1)

    return count
