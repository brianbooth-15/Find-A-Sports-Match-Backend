const AWS = require('aws-sdk');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = "UsersTable";

// Register (Sign Up) function
exports.signUp = async (event) => {
  const { email, password } = JSON.parse(event.body);

  const hashedPassword = await bcrypt.hash(password, 10);

  await dynamoDB.put({
    TableName: USERS_TABLE,
    Item: { email, password: hashedPassword },
  }).promise();

  return {
    statusCode: 201,
    body: JSON.stringify({ message: "User registered successfully" }),
  };
};

// Login function
exports.login = async (event) => {
  const { email, password } = JSON.parse(event.body);

  const user = await dynamoDB.get({
    TableName: USERS_TABLE,
    Key: { email },
  }).promise();

  if (!user.Item || !await bcrypt.compare(password, user.Item.password)) {
    return { statusCode: 401, body: JSON.stringify({ message: "Invalid credentials" }) };
  }

  const token = jwt.sign({ email }, "secret", { expiresIn: "1h" });

  return { statusCode: 200, body: JSON.stringify({ token }) };
};
