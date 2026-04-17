const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "data", "db.json");
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

const RECORD_TYPES = new Set(["Diploma", "Certificate", "CourseResult"]);

function ensureDb() {
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(
      DB_PATH,
      JSON.stringify({ students: [], records: [], shares: [], chain: [] }, null, 2)
    );
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "Content-Type": contentType });
    res.end(content);
  });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function id(prefix) {
  return `${prefix}-${crypto.randomBytes(4).toString("hex")}`;
}

function hashRecord(record) {
  return crypto.createHash("sha256").update(JSON.stringify(record)).digest("hex");
}

function normalizeType(type) {
  const value = String(type || "").trim();
  if (!value) {
    return "";
  }

  const aliases = {
    diploma: "Diploma",
    certificate: "Certificate",
    courseresult: "CourseResult",
    "course-result": "CourseResult",
    "course result": "CourseResult"
  };

  return aliases[value.toLowerCase()] || value;
}

function sanitizeShare(share, origin) {
  return {
    ...share,
    publicUrl: `${origin}/?share=${share.shareToken}`
  };
}

function getStudentSnapshot(record, student) {
  return {
    studentId: student.studentId,
    fullName: student.fullName,
    email: student.email,
    walletAddress: student.walletAddress,
    university: student.university,
    department: student.department,
    createdAt: student.createdAt,
    lastCredentialAt: record ? record.issuedAt : null
  };
}

function appendBlock(db, record) {
  const previousBlock = db.chain[db.chain.length - 1];
  const blockPayload = {
    index: db.chain.length,
    recordId: record.recordId,
    credentialHash: record.credentialHash,
    issuedAt: record.issuedAt,
    previousHash: previousBlock ? previousBlock.blockHash : "GENESIS"
  };
  const blockHash = hashRecord(blockPayload);
  const block = { ...blockPayload, blockHash };
  db.chain.push(block);
  return block;
}

function upsertStudent(db, payload) {
  const existingStudent = db.students.find(
    (item) =>
      (payload.studentId && item.studentId === payload.studentId) ||
      item.email.toLowerCase() === String(payload.email).toLowerCase()
  );

  if (existingStudent) {
    existingStudent.fullName = payload.fullName;
    existingStudent.email = payload.email;
    existingStudent.walletAddress = payload.walletAddress;
    existingStudent.university = payload.university;
    existingStudent.department = payload.department;
    return existingStudent;
  }

  const student = {
    studentId: payload.studentId || id("STD"),
    fullName: payload.fullName,
    email: payload.email,
    walletAddress: payload.walletAddress,
    university: payload.university,
    department: payload.department,
    createdAt: new Date().toISOString()
  };

  db.students.push(student);
  return student;
}

function createCredential(db, payload) {
  const student = upsertStudent(db, payload);
  const issuedAt = new Date().toISOString();

  const record = {
    recordId: id("REC"),
    type: normalizeType(payload.type),
    studentId: student.studentId,
    studentName: student.fullName,
    institutionName: payload.institutionName || payload.university || student.university,
    title: payload.title,
    specialization: payload.specialization || "",
    grade: payload.grade || "",
    courseHours: payload.courseHours || "",
    cohort: payload.cohort || "",
    description: payload.description || "",
    metadataVisibility: payload.metadataVisibility || "shared-by-consent",
    metadataUri: payload.metadataUri || `ipfs://demo/${id("META")}`,
    issuerWallet: payload.issuerWallet || "0xUniversityDemoWallet",
    ownerWallet: student.walletAddress,
    issuedAt,
    status: "active"
  };

  record.credentialHash = hashRecord(record);
  record.block = appendBlock(db, record);
  db.records.push(record);
  return record;
}

function createShare(db, payload) {
  const record = db.records.find((item) => item.recordId === payload.recordId);
  if (!record) {
    throw new Error("Record not found");
  }

  const share = {
    shareToken: crypto.randomBytes(12).toString("hex"),
    recordId: record.recordId,
    studentId: record.studentId,
    recipientName: payload.recipientName,
    recipientType: payload.recipientType,
    note: payload.note || "",
    createdAt: new Date().toISOString(),
    expiresAt: payload.expiresAt || null
  };

  db.shares.push(share);
  return share;
}

function getRecordDetails(db, record) {
  const student = db.students.find((item) => item.studentId === record.studentId) || null;
  const shareCount = db.shares.filter((item) => item.recordId === record.recordId).length;
  return {
    ...record,
    block: db.chain.find((item) => item.recordId === record.recordId) || record.block || null,
    student: student ? getStudentSnapshot(record, student) : null,
    shareCount
  };
}

function getStudentProfile(db, studentId) {
  const student = db.students.find((item) => item.studentId === studentId);
  if (!student) {
    return null;
  }

  const credentials = db.records
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
    .map((record) => getRecordDetails(db, record));

  const shares = db.shares
    .filter((item) => item.studentId === studentId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return {
    student: getStudentSnapshot(credentials[0], student),
    summary: {
      credentialCount: credentials.length,
      diplomaCount: credentials.filter((item) => item.type === "Diploma").length,
      certificateCount: credentials.filter((item) => item.type === "Certificate").length,
      courseResultCount: credentials.filter((item) => item.type === "CourseResult").length,
      shareCount: shares.length
    },
    credentials,
    shares
  };
}

function getDashboard(db, origin) {
  const totalCredentials = db.records.length;
  const activeCredentials = db.records.filter((item) => item.status === "active").length;
  const studentCount = db.students.length;
  const courseResults = db.records.filter((item) => item.type === "CourseResult").length;
  const diplomas = db.records.filter((item) => item.type === "Diploma").length;
  const certificates = db.records.filter((item) => item.type === "Certificate").length;
  const institutions = [...new Set(db.records.map((item) => item.institutionName))];

  return {
    stats: {
      totalCredentials,
      activeCredentials,
      studentCount,
      courseResults,
      diplomas,
      certificates,
      institutions: institutions.length
    },
    recentRecords: db.records.slice(-6).reverse().map((item) => getRecordDetails(db, item)),
    ledger: db.chain.slice(-6).reverse(),
    students: db.students
      .slice()
      .reverse()
      .slice(0, 6)
      .map((student) => getStudentProfile(db, student.studentId).student),
    shares: db.shares
      .slice(-6)
      .reverse()
      .map((share) => sanitizeShare(share, origin)),
    institutions: institutions.slice(0, 8)
  };
}

function listRecords(db, query) {
  const type = normalizeType(query.searchParams.get("type"));
  const search = String(query.searchParams.get("search") || "").trim().toLowerCase();
  const studentId = String(query.searchParams.get("studentId") || "").trim();

  return db.records
    .filter((record) => {
      if (type && record.type !== type) {
        return false;
      }
      if (studentId && record.studentId !== studentId) {
        return false;
      }
      if (!search) {
        return true;
      }

      const haystack = [
        record.recordId,
        record.studentName,
        record.title,
        record.institutionName,
        record.type,
        record.specialization
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    })
    .sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
    .map((record) => getRecordDetails(db, record));
}

function listStudents(db, query) {
  const search = String(query.searchParams.get("search") || "").trim().toLowerCase();

  return db.students
    .filter((student) => {
      if (!search) {
        return true;
      }

      return [student.studentId, student.fullName, student.email, student.university, student.department]
        .join(" ")
        .toLowerCase()
        .includes(search);
    })
    .map((student) => getStudentProfile(db, student.studentId))
    .sort((a, b) => new Date(b.student.createdAt) - new Date(a.student.createdAt));
}

function validateCredentialPayload(payload) {
  const requiredFields = [
    "fullName",
    "email",
    "walletAddress",
    "university",
    "department",
    "title",
    "type"
  ];

  const missing = requiredFields.filter((field) => !payload[field]);
  if (missing.length) {
    throw new Error(`Missing fields: ${missing.join(", ")}`);
  }

  const normalizedType = normalizeType(payload.type);
  if (!RECORD_TYPES.has(normalizedType)) {
    throw new Error("type must be Diploma, Certificate, or CourseResult");
  }
}

function seedDataIfEmpty() {
  const db = readDb();
  if (db.records.length > 0) {
    return;
  }

  createCredential(db, {
    fullName: "Aziza Karimova",
    email: "aziza@example.edu",
    walletAddress: "0xA91zaKariM0va",
    university: "Tashkent Digital University",
    department: "Software Engineering",
    title: "Bachelor Diploma in Computer Science",
    type: "Diploma",
    specialization: "AI and Data Systems",
    grade: "3.9 GPA",
    cohort: "2022-2026",
    description: "Four-year bachelor degree verified on Husanboy."
  });

  createCredential(db, {
    fullName: "Bekzod Rustamov",
    email: "bekzod@example.edu",
    walletAddress: "0xB3kzodRu5tam0v",
    university: "Open Skills Academy",
    department: "Online Learning",
    title: "Blockchain Fundamentals Certificate",
    type: "Certificate",
    courseHours: "48",
    grade: "95/100",
    cohort: "Spring 2026",
    description: "Professional certificate for blockchain system design."
  });

  createCredential(db, {
    fullName: "Madina Xolmurodova",
    email: "madina@example.edu",
    walletAddress: "0xMad1naX0lmur0d0va",
    university: "Husanboy Courses",
    department: "Online Learning",
    title: "Smart Contract Security Bootcamp",
    type: "CourseResult",
    courseHours: "72",
    grade: "Completed with distinction",
    cohort: "Cohort 8",
    description: "Online course result permanently anchored in the chain."
  });

  createCredential(db, {
    fullName: "Jasur Turgunov",
    email: "jasur@example.edu",
    walletAddress: "0xJasurTurGUN0v",
    university: "Samarkand Innovation University",
    department: "Cybersecurity",
    title: "Master Diploma in Information Security",
    type: "Diploma",
    specialization: "Digital Trust and Compliance",
    grade: "Excellent",
    cohort: "2024-2026",
    description: "Graduate diploma anchored for employer verification."
  });

  const firstRecord = db.records[0];
  const secondRecord = db.records[1];

  createShare(db, {
    recordId: firstRecord.recordId,
    recipientName: "Global HR Group",
    recipientType: "Employer",
    note: "Employment verification access"
  });

  createShare(db, {
    recordId: secondRecord.recordId,
    recipientName: "Westminster Partner University",
    recipientType: "University",
    note: "Transfer admissions review"
  });

  writeDb(db);
}

seedDataIfEmpty();

const server = http.createServer(async (req, res) => {
  const currentUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = currentUrl.pathname;
  const origin = currentUrl.origin;

  if (req.method === "OPTIONS") {
    sendJson(res, 200, { ok: true });
    return;
  }

  try {
    if (req.method === "GET" && pathname === "/api/dashboard") {
      const db = readDb();
      sendJson(res, 200, getDashboard(db, origin));
      return;
    }

    if (req.method === "GET" && pathname === "/api/records") {
      const db = readDb();
      const records = listRecords(db, currentUrl);
      sendJson(res, 200, { total: records.length, items: records });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/records/")) {
      const recordId = pathname.split("/").pop();
      const db = readDb();
      const record = db.records.find((item) => item.recordId === recordId);

      if (!record) {
        sendJson(res, 404, { message: "Credential not found" });
        return;
      }

      sendJson(res, 200, getRecordDetails(db, record));
      return;
    }

    if (req.method === "GET" && pathname === "/api/students") {
      const db = readDb();
      const students = listStudents(db, currentUrl);
      sendJson(res, 200, { total: students.length, items: students });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/students/")) {
      const studentId = pathname.split("/").pop();
      const db = readDb();
      const profile = getStudentProfile(db, studentId);

      if (!profile) {
        sendJson(res, 404, { message: "Student not found" });
        return;
      }

      sendJson(res, 200, profile);
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/verify/")) {
      const recordId = pathname.split("/").pop();
      const db = readDb();
      const record = db.records.find((item) => item.recordId === recordId);

      if (!record) {
        sendJson(res, 404, { valid: false, message: "Credential not found" });
        return;
      }

      const block = db.chain.find((item) => item.recordId === recordId);
      const recalculatedHash = hashRecord({
        ...record,
        block: undefined
      });

      sendJson(res, 200, {
        valid: record.status === "active" && !!block && recalculatedHash === record.credentialHash,
        proofStatus: recalculatedHash === record.credentialHash ? "hash-match" : "hash-mismatch",
        record: getRecordDetails(db, record),
        block
      });
      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/public/share/")) {
      const shareToken = pathname.split("/").pop();
      const db = readDb();
      const share = db.shares.find((item) => item.shareToken === shareToken);

      if (!share) {
        sendJson(res, 404, { message: "Share link not found" });
        return;
      }

      const record = db.records.find((item) => item.recordId === share.recordId);
      const student = db.students.find((item) => item.studentId === share.studentId);

      sendJson(res, 200, {
        share: sanitizeShare(share, origin),
        record: record ? getRecordDetails(db, record) : null,
        student: student ? getStudentSnapshot(record, student) : null
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/records") {
      const payload = await parseBody(req);
      validateCredentialPayload(payload);
      const db = readDb();
      const record = createCredential(db, payload);
      writeDb(db);
      sendJson(res, 201, {
        message: "Credential created and anchored to the ledger",
        record: getRecordDetails(db, record)
      });
      return;
    }

    if (req.method === "POST" && pathname === "/api/share") {
      const payload = await parseBody(req);
      if (!payload.recordId || !payload.recipientName || !payload.recipientType) {
        throw new Error("recordId, recipientName, recipientType are required");
      }
      const db = readDb();
      const share = createShare(db, payload);
      writeDb(db);
      sendJson(res, 201, {
        message: "Share link created",
        share: sanitizeShare(share, origin)
      });
      return;
    }

    let filePath = path.join(PUBLIC_DIR, pathname === "/" ? "index.html" : pathname);
    if (!filePath.startsWith(PUBLIC_DIR)) {
      sendJson(res, 403, { message: "Forbidden" });
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (fs.existsSync(filePath)) {
      sendFile(res, filePath);
      return;
    }

    sendJson(res, 404, { message: "Not found" });
  } catch (error) {
    sendJson(res, 400, { message: error.message || "Unexpected error" });
  }
});

server.listen(PORT, () => {
  console.log(`Husanboy running at http://localhost:${PORT}`);
});
