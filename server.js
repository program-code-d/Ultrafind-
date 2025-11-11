const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");

const PORT = 8080;
const USERS_FILE = "users.txt";
const UPLOADS_DIR = "uploads";
const MESSAGES_FILE = "messages.txt";
// Extensive list of Minnesota cities (partial but large)
const cities = [
  "Ada",
  "Aitkin",
  "Albert Lea",
  "Alexandria",
  "Andover",
  "Anoka",
  "Apple Valley",
  "Arden Hills",
  "Austin",
  "Baxter",
  "Bayport",
  "Bemidji",
  "Benson",
  "Blaine",
  "Bloomington",
  "Blue Earth",
  "Brooten",
  "Brooklyn Center",
  "Brooklyn Park",
  "Brainerd",
  "Buffalo",
  "Burnsville",
  "Byron",
  "Caledonia",
  "Cambridge",
  "Cannon Falls",
  "Carlton",
  "Carver",
  "Cloquet",
  "Cokato",
  "Cottage Grove",
  "Coon Rapids",
  "Crookston",
  "Crystal",
  "Dale",
  "Dalton",
  "Dawson",
  "Dayton",
  "Detroit Lakes",
  "Dilworth",
  "Dodge Center",
  "Duluth",
  "Eagan",
  "Eden Prairie",
  "Edina",
  "Elk River",
  "Ely",
  "Elyria",
  "Ellendale",
  "Faribault",
  "Farmington",
  "Fergus Falls",
  "Finlayson",
  "Forest Lake",
  "Fort Ripley",
  "Fridley",
  "Gibbon",
  "Glenwood",
  "Glyndon",
  "Grand Marais",
  "Grand Meadow",
  "Grand Marais",
  "Grand Rapids",
  "Granite Falls",
  "Hastings",
  "Hibbing",
  "Henderson",
  "Hermantown",
  "Hutchinson",
  "International Falls",
  "Isanti",
  "Jackson",
  "Jordan",
  "Karlstad",
  "Kasson",
  "Keewatin",
  "Kerkhoven",
  "Kimball",
  "Lake City",
  "Lake Crystal",
  "Lake Elmo",
  "Lakeville",
  "Lanesboro",
  "Le Sueur",
  "LeCenter",
  "Little Falls",
  "Little Canada",
  "Litchfield",
  "Lynd",
  "Madison",
  "Mankato",
  "Mahtomedi",
  "Mandan",
  "Maple Grove",
  "Maple Lake",
  "Maple Plain",
  "Maplewood",
  "Marshall",
  "Mayer",
  "Medford",
  "Medina",
  "Mendota Heights",
  "Moorhead",
  "Monticello",
  "Montevideo",
  "Morristown",
  "Morris",
  "Mountain Iron",
  "New Brighton",
  "New Hope",
  "New Ulm",
  "Nisswa",
  "North Branch",
  "North Mankato",
  "Northfield",
  "Norwood Young America",
  "Oak Grove",
  "Oakdale",
  "Ollie",
  "Onamia",
  "Orono",
  "Ortonville",
  "Osakis",
  "Owatonna",
  "Palisade",
  "Paynesville",
  "Pelican Rapids",
  "Perham",
  "Pierz",
  "Pine City",
  "Pipestone",
  "Plainview",
  "Princeton",
  "Prior Lake",
  "Princeton",
  "Ramsey",
  "Red Wing",
  "Redwood Falls",
  "Richfield",
  "Rochester",
  "Rockford",
  "Rosemount",
  "Roseau",
  "Roseville",
  "Sartell",
  "Saunders?",
  "Sauk Centre",
  "Sauk Rapids",
  "Shakopee",
  "Shoreview",
  "Silver Bay",
  "Sleepy Eye",
  "Slayton",
  "South St Paul",
  "Spring Grove",
  "Spring Lake Park",
  "St Cloud",
  "St Joseph",
  "St Louis Park",
  "St Michael",
  "St Paul",
  "St Paul Park",
  "St Peter",
  "Starbuck",
  "Staples",
  "Stillwater",
  "Stewartville",
  "Thief River Falls",
  "Thompson",
  "Thomson",
  "Tracy",
  "Twin Valley",
  "Two Harbors",
  "Vadnais Heights",
  "Virginia",
  "Waconia",
  "Wadena",
  "Waite Park",
  "Walker",
  "Warroad",
  "Watertown",
  "Waseca",
  "Waterville",
  "Wayzata",
  "Webster",
  "Wells",
  "West St Paul",
  "Westbrook",
  "Wheaton",
  "Willmar",
  "Winnebago",
  "Winona",
  "Worthington",
  "Wyoming",
  "Zumbrota",
  "Zimmerman",
];
let users = [];
let messages = [];

// Create uploads dir if missing
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Hash password helper
function hashPassword(passw_string) {
  return crypto.createHash("sha256").update(String(passw_string)).digest("hex");
}

// Password strength validation: at least 8 chars, include upper, lower, number, special
function isStrongPassword(pw) {
  if (!pw || typeof pw !== "string") return false;
  // Require: min 8 chars, one lowercase, one uppercase, one digit, one special char
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;
  return re.test(pw);
}
// Load existing users
try {
  const raw = fs.readFileSync(USERS_FILE, "utf8");
  users = raw ? JSON.parse(raw) : [];

  // Normalize old salts
  users = users.map((u) => {
    if (u && typeof u.salt === "string" && /^\d+$/.test(u.salt)) {
      u.salt = Number(u.salt);
    }
    return u;
  });
} catch {
  users = [];
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Load existing messages
try {
  const messageData = fs.readFileSync(MESSAGES_FILE, "utf8");
  messages = messageData ? JSON.parse(messageData) : [];
} catch {
  messages = [];
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

function saveUsers() {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function saveMessages() {
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

function getMessages(from, to) {
  return messages
    .filter(
      (msg) =>
        (msg.from === from && msg.to === to) ||
        (msg.from === to && msg.to === from)
    )
    .sort((a, b) => a.timestamp - b.timestamp);
}

function create_new_account(password, email, first_name, last_name, location) {
  const salt = Math.floor(Math.random() * 1e9);
  const hashed = hashPassword(password + salt);
  const newUser = {
    email: String(email),
    first_name: String(first_name),
    last_name: String(last_name),
    location: String(location),
    password: hashed,
    salt: salt,
    listings: [],
    profile_pic: "",
  };
  users.push(newUser);
  saveUsers();
  console.log("Created user:", email);
}

// Find user helper
function findUserIndex(email, password) {
  return users.findIndex(
    (u) => u.email === email && u.password === hashPassword(password + u.salt)
  );
}

// HTTP request handler
function handleRequest(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  // Serve files
  if (req.method === "GET") {
    let filePath = req.url === "/" ? "login.html" : req.url.substring(1);
    filePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, "");

    if (filePath.startsWith(UPLOADS_DIR)) {
      const imagePath = path.join(__dirname, filePath);
      fs.readFile(imagePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("Not Found");
          return;
        }
        const ext = path.extname(imagePath).toLowerCase();
        const mime =
          ext === ".png"
            ? "image/png"
            : ext === ".gif"
            ? "image/gif"
            : "image/jpeg";
        res.writeHead(200, { "Content-Type": mime });
        res.end(data);
      });
      return;
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end("Not Found");
        return;
      }
      let type = "text/html";
      if (filePath.endsWith(".js")) type = "text/javascript";
      else if (filePath.endsWith(".css")) type = "text/css";
      else if (filePath.endsWith(".json")) type = "application/json";
      res.writeHead(200, { "Content-Type": type });
      res.end(data);
    });
    return;
  }

  // Handle POST requests
  if (req.method !== "POST") {
    res.writeHead(404);
    res.end("Not Found");
    return;
  }

  const chunks = [];
  req.on("data", (c) => {
    chunks.push(c);
    if (Buffer.concat(chunks).length > 5e7) req.connection.destroy(); // 50MB limit
  });

  req.on("end", () => {
    let parsed = {};
    try {
      parsed = chunks.length
        ? JSON.parse(Buffer.concat(chunks).toString("utf8"))
        : {};
    } catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid JSON" }));
      return;
    }

    // Commands start
    const cmd = parsed.cmd;

    if (cmd === "login") {
      const userIndex = findUserIndex(parsed.username, parsed.password);
      const data =
        userIndex !== -1 ? { login_success: 1 } : { login_success: 0 };
      if (userIndex !== -1) console.log("Login success for", parsed.username);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data }));
      return;
    }

    if (cmd === "sign_up") {
      // Validate required fields
      const requiredFields = [
        "password",
        "email",
        "first_name",
        "last_name",
        "location",
      ];
      const missingFields = requiredFields.filter((field) => !parsed[field]);

      if (missingFields.length > 0) {
        console.error("Sign up failed - missing fields:", missingFields);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Missing required fields",
            missing: missingFields,
          })
        );
        return;
      }

      // Validate password strength BEFORE creating the account
      if (!isStrongPassword(parsed.password)) {
        console.error("Sign up failed - weak password for:", parsed.email);
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Weak password",
            message:
              "Password must be at least 8 characters and include uppercase, lowercase, a number, and a special character.",
          })
        );
        return;
      }

      // Check if email already exists
      if (users.some((u) => u.email === parsed.email)) {
        console.error("Sign up failed - email already exists:", parsed.email);
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Email already exists",
          })
        );
        return;
      }

      try {
        create_new_account(
          parsed.password,
          parsed.email,
          parsed.first_name,
          parsed.last_name,
          parsed.location
        );

        console.log("Sign up successful for:", parsed.email);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: { signed_up: 1 } }));
      } catch (error) {
        console.error("Sign up failed - error creating account:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Failed to create account",
            details: error.message,
          })
        );
      }
      return;
    }

    if (cmd === "change_email") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false }));
        return;
      }
      users[idx].email = parsed.new_email;
      saveUsers();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true, new_email: parsed.new_email }));
      return;
    }

    if (cmd === "change_password") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false }));
        return;
      }
      // Validate new password strength
      if (!parsed.new_password || !isStrongPassword(parsed.new_password)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "New password does not meet strength requirements",
          })
        );
        return;
      }

      users[idx].password = hashPassword(parsed.new_password + users[idx].salt);
      saveUsers();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (cmd === "change_age") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false }));
        // Validate new password strength
        if (!parsed.new_password || !isStrongPassword(parsed.new_password)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              success: false,
              error: "New password does not meet strength requirements",
            })
          );
          return;
        }
        return;
      }
      users[idx].age = parsed.age;
      saveUsers();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (cmd === "change_name") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false }));
        return;
      }
      if (!parsed.first_name || !parsed.last_name) {
        res.writeHead(400);
        res.end(
          JSON.stringify({
            success: false,
            error: "First name and last name are required",
          })
        );
        return;
      }
      users[idx].first_name = parsed.first_name;
      users[idx].last_name = parsed.last_name;
      saveUsers();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (cmd === "change_location") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false }));
        return;
      }
      users[idx].location = parsed.location;
      saveUsers();
      res.writeHead(200);
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (cmd === "get_location") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: { location: users[idx].location } }));
      return;
    }

    if (cmd === "search_jobs") {
      const query = (parsed.job_search || "").toLowerCase();
      const listings = [];
      for (const user of users) {
        if (!user.listings) continue;
        for (const l of user.listings) {
          const title = (l.listing_title || "").toLowerCase();
          const desc = (l.description || "").toLowerCase();
          if (title.includes(query) || desc.includes(query)) {
            // Add the listing owner's email to each listing
            listings.push({
              ...l,
              user_email: user.email,
            });
          }
        }
      }
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: { listings_to_return: listings } }));
      return;
    }

    if (cmd === "get_messages") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }

      const chatMessages = getMessages(parsed.email, parsed.other_user);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, messages: chatMessages }));
      return;
    }

    if (cmd === "send_message") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }

      if (!parsed.to || !parsed.message) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: "Missing recipient or message" }));
        return;
      }

      // Check if recipient exists
      const recipientExists = users.some((u) => u.email === parsed.to);
      if (!recipientExists) {
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Recipient not found" }));
        return;
      }

      // Add message
      messages.push({
        from: parsed.email,
        to: parsed.to,
        message: parsed.message,
        timestamp: Date.now(),
      });

      saveMessages();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    if (cmd === "create_listing") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403);
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }

      const imagePaths = [];
      if (parsed.pic && Array.isArray(parsed.pic)) {
        parsed.pic.forEach((base64Image) => {
          const match = base64Image.match(/^data:(.+?);base64,(.+)$/);
          if (match) {
            const mimeType = match[1];
            const ext = mimeType.split("/")[1];
            const fileName = `${crypto.randomBytes(16).toString("hex")}.${ext}`;
            const filePath = path.join(UPLOADS_DIR, fileName);
            fs.writeFileSync(filePath, match[2], "base64");
            imagePaths.push(`/${UPLOADS_DIR}/${fileName}`);
          }
        });
      }

      users[idx].listings.push({
        listing_title: parsed.listing_title,
        pic: imagePaths,
        description: parsed.description,
        age: parsed.age,
        age_suggested: parsed.age_suggested,
        age_required: parsed.age_required,
        city: parsed.city,
        date: parsed.date,
        payinfo: parsed.payinfo,
        ownerEmail: parsed.email,
        id: crypto.randomBytes(8).toString("hex"),
        created_at: Date.now(),
      });

      saveUsers();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ data: { successfully_made_listing: 1 } }));
      return;
    }

    // Return basic profile info for the logged-in user
    if (cmd === "get_profile") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }
      const u = users[idx];
      const profile = {
        first_name: u.first_name || "",
        last_name: u.last_name || "",
        email: u.email || "",
        location: u.location || "",
        profile_pic: u.profile_pic || "",
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, profile }));
      return;
    }

    // Return listings belonging to the authenticated user
    if (cmd === "get_my_listings") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }
      const myListings = users[idx].listings || [];
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true, listings: myListings }));
      return;
    }

    // Delete a listing owned by the authenticated user
    if (cmd === "delete_listing") {
      const idx = findUserIndex(parsed.email, parsed.password);
      if (idx === -1) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Invalid credentials" }));
        return;
      }
      const listingId = parsed.listing_id;
      if (!listingId) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Missing listing_id" }));
        return;
      }
      const userListings = users[idx].listings || [];
      const pos = userListings.findIndex((l) => l.id === listingId);
      if (pos === -1) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Listing not found" }));
        return;
      }
      // Optionally delete uploaded images from disk
      const toRemove = userListings[pos];
      if (Array.isArray(toRemove.pic)) {
        toRemove.pic.forEach((p) => {
          try {
            const pth = path.join(__dirname, p);
            if (fs.existsSync(pth)) fs.unlinkSync(pth);
          } catch (e) {
            // ignore file removal errors
          }
        });
      }
      userListings.splice(pos, 1);
      users[idx].listings = userListings;
      saveUsers();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ success: true }));
      return;
    }

    // Unknown command
    res.writeHead(400);
    res.end(JSON.stringify({ error: "Invalid or unsupported command" }));
  });
}

const server = http.createServer(handleRequest);
server.listen(PORT, () =>
  console.log(`✅ Server running at http://localhost:${PORT}/`)
);
