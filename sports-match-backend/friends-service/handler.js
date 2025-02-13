const AWS = require("aws-sdk");

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const PROFILE_TABLE = "UserProfiles";
const MAX_BATCH_SIZE = 10; // Limit results for better performance

// ✅ Haversine Formula to calculate distance in KM
const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of Earth in KM
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in KM
};

// ✅ Convert DynamoDB nested location format into usable values
const extractLocation = (location) => {
    if (!location || !location.latitude || !location.longitude) {
      console.error("Missing location data:", location);
      return null;
    }
  
    // Log raw data for debugging
    console.log("Raw DynamoDB location data:", location);
    console.log("Raw latitude:", location.latitude, "Raw longitude:", location.longitude);
    console.log("Raw latitude type:", typeof location.latitude, "Raw longitude type:", typeof location.longitude);
  
    // Check if the latitude and longitude are already valid numbers
    const latitude = isNaN(location.latitude) ? parseFloat(location.latitude.N) : location.latitude;  
    const longitude = isNaN(location.longitude) ? parseFloat(location.longitude.N) : location.longitude;
  
    // Log the parsed values for debugging
    console.log("Parsed latitude:", latitude, "Parsed longitude:", longitude);
  
    // Validate if the parsed values are valid numbers
    if (isNaN(latitude) || isNaN(longitude)) {
      console.error("Invalid location data:", location);
      return null;
    }
  
    return { latitude, longitude };
  };
  

// ✅ Convert nested DynamoDB sports format into a usable object
const extractSelectedSports = (sportsMap) => {
    if (!sportsMap) return {};
  
    const sports = {};
    console.log("Extracting sports from:", sportsMap); // Log raw sportsMap
  
    Object.entries(sportsMap).forEach(([sport, details]) => {
      console.log(`Processing sport: ${sport}, details: ${JSON.stringify(details)}`); // Log each sport and its details
  
      // Check if 'details' is an object with gender and level properties
      if (details && details.gender && details.level) {
        sports[sport] = {
          level: details.level,  // Assuming level is a direct property
          gender: details.gender // Assuming gender is a direct property
        };
        console.log(`Extracted: ${sport} => level: ${sports[sport].level}, gender: ${sports[sport].gender}`);
      } else {
        console.log(`Skipping invalid sport data for ${sport}: ${JSON.stringify(details)}`);
      }
    });
  
    console.log("Extracted sports:", sports); // Log the final sports object
    return sports;
  };
  

exports.matchFriends = async (event) => {
    try {
      const { email } = JSON.parse(event.body);
      console.log("Parsed email:", email);
  
      // ✅ Fetch the user's profile from DynamoDB
      const userProfile = await dynamoDB.get({
        TableName: PROFILE_TABLE,
        Key: { email },
      }).promise();
  
      if (!userProfile.Item) {
        console.log("User profile not found for:", email);
        return { statusCode: 404, body: JSON.stringify({ message: "User profile not found" }) };
      }
  
      console.log("User profile found:", userProfile.Item);
  
      const userLocation = extractLocation(userProfile.Item.location);
      const userSelectedSports = extractSelectedSports(userProfile.Item.selectedSports);
      const userRadius = userProfile.Item.radius || 10;
  
      console.log("User location:", userLocation);
      console.log("User selected sports:", userSelectedSports);
      console.log("User radius:", userRadius);
  
      // ✅ Scan for all profiles in DynamoDB
      const allProfiles = await dynamoDB.scan({ TableName: PROFILE_TABLE }).promise();
      console.log("Fetched profiles:", allProfiles.Items.length);
  
      // ✅ Filter potential matches based on distance, sport, and preferences
      const matches = allProfiles.Items
        .filter(profile => profile.email !== email) // Exclude self
        .map(profile => {
          const profileLocation = extractLocation(profile.location);
          if (!profileLocation) return null; // Skip profiles without location
  
          const profileSports = extractSelectedSports(profile.selectedSports);
  
          // ✅ Check if locations are the same, and skip if they are
          if (userLocation.latitude === profileLocation.latitude && userLocation.longitude === profileLocation.longitude) {
            console.log(`Skipping match: ${email} and ${profile.email} have the same location`);
            return null; // Skip if location is identical
          }
  
          // ✅ Check distance
          const distance = getDistance(
            userLocation.latitude, userLocation.longitude,
            profileLocation.latitude, profileLocation.longitude
          );
          console.log(`Distance between ${email} and ${profile.email}: ${distance.toFixed(1)} km`);
  
          if (distance > userRadius) return null; // Skip if outside radius
  
          // ✅ Find at least one matching sport and stop checking further
          let matchedSports = [];
          console.log(`Checking user selected sports:`, userSelectedSports);
          console.log(`Checking profile sports:`, profileSports);
          for (const sport of Object.keys(userSelectedSports)) {
            console.log(`Checking sport: ${sport}`);
            if (profileSports[sport]) {
              console.log(`Sport found: ${sport}`);
              const userLevel = userSelectedSports[sport].level;
              const matchLevel = profileSports[sport].level;
              const userGenderPref = userSelectedSports[sport].gender;
              const matchGender = profileSports[sport].gender;
  
              // Log the comparison values for debugging
              console.log(`Checking match for sport: ${sport}`);
              console.log(`User Level: ${userLevel}, Match Level: ${matchLevel}`);
              console.log(`User Gender Pref: ${userGenderPref}, Match Gender: ${matchGender}`);
  
              // ✅ Check if skill level & gender preferences align
              if (
                userLevel === matchLevel &&
                (userGenderPref === "Both" || userGenderPref === matchGender)
              ) {
                matchedSports.push({ sport, level: userLevel });
                console.log(`Match found for sport: ${sport} with level: ${userLevel}`);
                break; // ✅ Stop checking after finding one valid match
              } else {
                console.log(`No match for sport: ${sport}`);
              }
            }
          }
  
          return matchedSports.length > 0
            ? {
                email: profile.email,
                name: profile.name,
                distance: `${distance.toFixed(1)} km`, // ✅ Include distance
                matchedSports,
              }
            : null;
        })
        .filter(profile => profile !== null)
        .slice(0, MAX_BATCH_SIZE); // ✅ Return in batches
  
      console.log("Matches found:", matches.length);
  
      return { statusCode: 200, body: JSON.stringify({ matches }) };
    } catch (error) {
      console.error("Error finding matches:", error);
      return { statusCode: 500, body: JSON.stringify({ message: "Internal Server Error" }) };
    }
  };
  
