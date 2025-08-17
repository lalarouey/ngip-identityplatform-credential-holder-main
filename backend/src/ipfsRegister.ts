/**
 * Function to execute a SQL statement on a SQLite database.
 * @param db the SQLite database instance
 * @param sql the SQL statement to execute
 * @param params the parameters to bind to the SQL statement
 * @returns
 */
export const execute = async (db: any, sql: string, params: any[]) => {
  if (params && params.length > 0) {
    return new Promise<void>((resolve, reject) => {
      db.run(sql, params, (err: any) => {
        if (err) reject(err);
        resolve();
      });
    });
  }
  return new Promise<void>((resolve, reject) => {
    db.exec(sql, (err: any) => {
      if (err) reject(err);
      resolve();
    });
  });
};

export const fetchAll = async (db: any, sql: string, params: any[]) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err: any, rows: unknown) => {
      if (err) reject(err);
      resolve(rows);
    });
  });
};

export const fetchFirst = async (db: any, sql: string, params: any[]) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err: any, row: unknown) => {
      if (err) reject(err);
      resolve(row);
    });
  });
};
