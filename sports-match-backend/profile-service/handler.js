const AWS = require("aws-sdk");

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PROFILE_TABLE = "UserProfiles";

// 📌 Create or update a user profile
exports.createProfile = async (event) => {
  try {
    const { email, name, dob, availability, selectedSports, radius, location } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ message: "Email is required." }) };
    }

    const profileData = {
      TableName: PROFILE_TABLE,
      Item: { email, name, dob, availability, selectedSports, radius, location },
    };

    await dynamoDB.put(profileData).promise();

    return { statusCode: 201, body: JSON.stringify({ message: "Profile created successfully!" }) };
  } catch (error) {
    console.error("Error creating profile:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal Server Error" }) };
  }
};

// 📌 Fetch user profile by email
exports.getProfile = async (event) => {
  try {
    const { email } = event.pathParameters;

    const params = {
      TableName: PROFILE_TABLE,
      Key: { email },
    };

    const result = await dynamoDB.get(params).promise();

    if (!result.Item) {
      return { statusCode: 404, body: JSON.stringify({ message: "Profile not found." }) };
    }

    return { statusCode: 200, body: JSON.stringify(result.Item) };
  } catch (error) {
    console.error("Error fetching profile:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal Server Error" }) };
  }
};

// 📌 Update user profile
exports.updateProfile = async (event) => {
  try {
    const { email, name, dob, availability, selectedSports, radius, location } = JSON.parse(event.body);

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ message: "Email is required." }) };
    }

    const updateParams = {
      TableName: PROFILE_TABLE,
      Key: { email },
      UpdateExpression:
        "set #name = :name, dob = :dob, availability = :availability, selectedSports = :selectedSports, radius = :radius, location = :location",
      ExpressionAttributeNames: { "#name": "name" }, // 'name' is a reserved keyword in DynamoDB
      ExpressionAttributeValues: {
        ":name": name || null,
        ":dob": dob || null,
        ":availability": availability || null,
        ":selectedSports": selectedSports || null,
        ":radius": radius || 10,
        ":location": location || null,
      },
      ReturnValues: "UPDATED_NEW",
    };

    await dynamoDB.update(updateParams).promise();

    return { statusCode: 200, body: JSON.stringify({ message: "Profile updated successfully!" }) };
  } catch (error) {
    console.error("Error updating profile:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Internal Server Error" }) };
  }
};
