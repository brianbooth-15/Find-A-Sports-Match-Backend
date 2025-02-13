const AWS = require("aws-sdk");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const USERS_TABLE = "UsersTable";

// 🔐 Secure secret key (use AWS Secrets Manager or environment variables in production)
const JWT_SECRET = process.env.JWT_SECRET || "your-very-secret-key";

// ✅ Common CORS Headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
};

// ✅ Sign Up Function (User Registration)
exports.signUp = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Save user to DynamoDB
    await dynamoDB
      .put({
        TableName: USERS_TABLE,
        Item: { email, password: hashedPassword },
      })
      .promise();

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "User registered successfully" }),
    };
  } catch (error) {
    console.error("SignUp Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

// ✅ Login Function
exports.login = async (event) => {
  try {
    const { email, password } = JSON.parse(event.body);

    // Get user from DynamoDB
    const user = await dynamoDB
      .get({
        TableName: USERS_TABLE,
        Key: { email },
      })
      .promise();

    if (!user.Item || !(await bcrypt.compare(password, user.Item.password))) {
      return {
        statusCode: 401,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Invalid credentials" }),
      };
    }

    // Generate JWT token
    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: "1h" });

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ token }),
    };
  } catch (error) {
    console.error("Login Error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  }
};

// ✅ OPTIONS Handler (Fixes CORS Preflight Requests)
exports.options = async () => {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: "CORS preflight successful" }),
  };
};
