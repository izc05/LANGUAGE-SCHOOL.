/// <reference path="../pb_data/types.d.ts" />

routerAdd("POST", "/api/language-school/zoom/classes/{classId}/sdk-auth", (e) => {
  if (!e.auth || e.auth.get("role") !== "STUDENT") {
    throw new ForbiddenError("Solo un alumno matriculado puede solicitar acceso al aula online.")
  }

  function hasActiveEnrollment(app, studentId, groupId) {
    const enrollments = app.findAllRecords("enrollments")
    for (let index = 0; index < enrollments.length; index += 1) {
      const enrollment = enrollments[index]
      if (
        enrollment.getString("student") === studentId &&
        enrollment.getString("group") === groupId &&
        enrollment.getString("status") === "ACTIVE"
      ) {
        return true
      }
    }
    return false
  }

  function findReadyMeeting(app, classId) {
    const meetings = app.findAllRecords("zoom_meetings")
    for (let index = 0; index < meetings.length; index += 1) {
      const meeting = meetings[index]
      if (
        meeting.getString("class") === classId &&
        meeting.getString("status") === "READY" &&
        meeting.getString("external_meeting_id")
      ) {
        return meeting
      }
    }
    return null
  }

  function meetingSdkCredentials() {
    if ($os.getenv("LANGUAGE_SCHOOL_E2E") === "1") {
      return {
        clientId: "e2e-meeting-sdk-client",
        clientSecret: "e2e-meeting-sdk-secret",
      }
    }
    return {
      clientId: $os.getenv("ZOOM_MEETING_SDK_CLIENT_ID"),
      clientSecret: $os.getenv("ZOOM_MEETING_SDK_CLIENT_SECRET"),
    }
  }

  const classId = String(e.request.pathValue("classId") || "").trim()
  if (!classId) throw new BadRequestError("Falta la clase que se quiere abrir.")

  const classRecord = e.app.findRecordById("classes", classId)
  if (classRecord.getString("status") !== "SCHEDULED") {
    throw new BadRequestError("Esta clase ya no está disponible como sesión programada.")
  }

  const mode = classRecord.getString("delivery_mode") || "IN_PERSON"
  if (mode !== "ONLINE" && mode !== "HYBRID") {
    throw new BadRequestError("Esta clase no tiene aula online.")
  }

  const groupId = classRecord.getString("group")
  if (!groupId || !hasActiveEnrollment(e.app, e.auth.id, groupId)) {
    throw new ForbiddenError("No tienes una matrícula activa para esta clase.")
  }

  const meeting = findReadyMeeting(e.app, classId)
  if (!meeting) {
    return e.json(409, {
      provider: "zoom",
      authorized: false,
      reason: "meeting_not_ready",
      message: "El aula online todavía no está preparada.",
    })
  }

  const credentials = meetingSdkCredentials()
  if (!credentials.clientId || !credentials.clientSecret) {
    return e.json(409, {
      provider: "zoom",
      authorized: false,
      reason: "missing_sdk_credentials",
      message: "El Meeting SDK todavía no está configurado en el servidor.",
    })
  }

  const meetingNumber = meeting.getString("external_meeting_id")
  const issuedAt = Math.floor(Date.now() / 1000) - 30
  const expiresAt = Math.floor(Date.now() / 1000) + 3600
  const payload = {
    appKey: credentials.clientId,
    sdkKey: credentials.clientId,
    mn: meetingNumber,
    role: 0,
    iat: issuedAt,
    exp: expiresAt,
    tokenExp: expiresAt,
  }

  const signature = $security.createJWT(payload, credentials.clientSecret, 3600)
  const displayName = [e.auth.getString("name"), e.auth.getString("surname")].filter(Boolean).join(" ").trim() || "Alumno Language School"

  return e.json(200, {
    provider: "zoom",
    authorized: true,
    signature,
    meetingNumber,
    password: meeting.getString("meeting_password") || "",
    userName: displayName,
    role: 0,
    expiresAt,
  })
}, $apis.requireAuth("users"))
