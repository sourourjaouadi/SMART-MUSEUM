// Runs once, when the database volume is empty.
const target = db.getSiblingDB(process.env.MONGO_APP_DATABASE);
target.createUser({
  user: process.env.MONGO_APP_USER,
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: process.env.MONGO_APP_DATABASE }],
});
