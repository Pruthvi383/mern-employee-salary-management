export const formatDate = (dateValue) => {
    const date = dateValue instanceof Date ? dateValue : new Date(dateValue);
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = date.getUTCFullYear();

    return `${dd}/${mm}/${yyyy}`;
};
