const AWS = require("aws-sdk");
const jwt = require("jsonwebtoken");

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PROFILE_TABLE = "UserProfiles";
const JWT_SECRET = process.env.JWT_SECRET || "your-very-secret-key";

// ✅ Common CORS Headers
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "OPTIONS, GET, POST, PUT",
};

// ✅ Verify JWT Token
const verifyToken = (event) => {
  const authHeader = event.headers?.Authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }
  const token = authHeader.split(" ")[1];
  return jwt.verify(token, JWT_SECRET);
};

// 📌 **Create or Update Profile**
exports.createProfile = async (event) => {
  try {
    const user = verifyToken(event); // 🔐 Authenticate user
    const { name, dob, availability, selectedSports, radius, location } = JSON.parse(event.body);

    const profileData = {
      TableName: PROFILE_TABLE,
      Item: { email: user.email, name, dob, availability, selectedSports, radius, location },
    };

    await dynamoDB.put(profileData).promise();

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Profile created/updated successfully!" }),
    };
  } catch (error) {
    console.error("CreateProfile Error:", error);
    return {
      statusCode: error.message === "Unauthorized" ? 401 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

// 📌 **Fetch Profile**
exports.getProfile = async (event) => {
  try {
    const user = verifyToken(event); // 🔐 Authenticate user

    const params = {
      TableName: PROFILE_TABLE,
      Key: { email: user.email },
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "Profile not found." }),
      };
    }

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(result.Item),
    };
  } catch (error) {
    console.error("GetProfile Error:", error);
    return {
      statusCode: error.message === "Unauthorized" ? 401 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

// 📌 **Update Profile**
exports.updateProfile = async (event) => {
  try {
    const user = verifyToken(event); // 🔐 Authenticate user
    const { name, dob, availability, selectedSports, radius, location } = JSON.parse(event.body);

    const updateExpression = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};

    if (name) {
      updateExpression.push("#name = :name");
      expressionAttributeNames["#name"] = "name";
      expressionAttributeValues[":name"] = name;
    }
    if (dob) updateExpression.push("dob = :dob"), (expressionAttributeValues[":dob"] = dob);
    if (availability) updateExpression.push("availability = :availability"), (expressionAttributeValues[":availability"] = availability);
    if (selectedSports) updateExpression.push("selectedSports = :selectedSports"), (expressionAttributeValues[":selectedSports"] = selectedSports);
    if (radius) updateExpression.push("radius = :radius"), (expressionAttributeValues[":radius"] = radius);
    if (location) updateExpression.push("location = :location"), (expressionAttributeValues[":location"] = location);

    if (updateExpression.length === 0) {
      return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ message: "No fields to update." }) };
    }

    const updateParams = {
      TableName: PROFILE_TABLE,
      Key: { email: user.email },
      UpdateExpression: `SET ${updateExpression.join(", ")}`,
      ExpressionAttributeNames: Object.keys(expressionAttributeNames).length ? expressionAttributeNames : undefined,
      ExpressionAttributeValues,
      ReturnValues: "UPDATED_NEW",
    };

    await dynamoDB.update(updateParams).promise();

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "Profile updated successfully!" }),
    };
  } catch (error) {
    console.error("UpdateProfile Error:", error);
    return {
      statusCode: error.message === "Unauthorized" ? 401 : 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: error.message }),
    };
  }
};

// 📌 **OPTIONS Handler (CORS Fix)**
exports.options = async () => {
  return {
    statusCode: 200,
    headers: CORS_HEADERS,
    body: JSON.stringify({ message: "CORS preflight successful" }),
  };
};
