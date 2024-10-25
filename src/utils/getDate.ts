const getDate = (inputDateString?: string) => {
  const date = inputDateString ? new Date(inputDateString) : new Date();

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  const formattedDate = `${day}-${month}-${year}`;
  return formattedDate;
};
export { getDate };
