/// <reference path="../pb_data/types.d.ts" />

function zoomBase64Ascii(value) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
  let output = ""
  let index = 0

  while (index < value.length) {
    const byte1 = value.charCodeAt(index++) & 255
    const hasByte2 = index < value.length
    const byte2 = hasByte2 ? value.charCodeAt(index++) & 255 : 0
    const hasByte3 = index < value.length
    const byte3 = hasByte3 ? value.charCodeAt(index++) & 255 : 0

    output += chars.charAt(byte1 >> 2)
    output += chars.charAt(((byte1 & 3) << 4) | (byte2 >> 4))
    output += hasByte2 ? chars.charAt(((byte2 & 15) << 2) | (byte3 >> 6)) : "="
    output += hasByte3 ? chars.charAt(byte3 & 63) : "="
  }

  return output
}

routerAdd("POST", "/api/language-school/zoom/check", (e) => {
  if (!e.auth || e.auth.get("role") !== "ADMIN") {
    throw new ForbiddenError("Solo Administración puede comprobar la conexión con Zoom.")
  }

  const accountId = $os.getenv("ZOOM_ACCOUNT_ID")
  const clientId = $os.getenv("ZOOM_CLIENT_ID")
  const clientSecret = $os.getenv("ZOOM_CLIENT_SECRET")

  if (!accountId || !clientId || !clientSecret) {
    return e.json(200, {
      provider: "zoom",
      configured: false,
      connected: false,
      reason: "missing_credentials",
    })
  }

  try {
    const authorization = "Basic " + zoomBase64Ascii(clientId + ":" + clientSecret)
    const tokenResponse = $http.send({
      url: "https://zoom.us/oauth/token?grant_type=account_credentials&account_id=" + encodeURIComponent(accountId),
      method: "POST",
      headers: {
        "Authorization": authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      timeout: 20,
    })

    if (tokenResponse.statusCode !== 200 || !tokenResponse.json || !tokenResponse.json.access_token) {
      return e.json(200, {
        provider: "zoom",
        configured: true,
        connected: false,
        reason: "oauth_failed",
        statusCode: tokenResponse.statusCode,
      })
    }

    const userResponse = $http.send({
      url: "https://api.zoom.us/v2/users/me",
      method: "GET",
      headers: {
        "Authorization": "Bearer " + tokenResponse.json.access_token,
        "Accept": "application/json",
      },
      timeout: 20,
    })

    if (userResponse.statusCode !== 200 || !userResponse.json) {
      return e.json(200, {
        provider: "zoom",
        configured: true,
        connected: false,
        reason: "api_failed",
        statusCode: userResponse.statusCode,
      })
    }

    return e.json(200, {
      provider: "zoom",
      configured: true,
      connected: true,
      reason: "ok",
      accountUser: {
        id: userResponse.json.id || "",
        displayName: userResponse.json.display_name || [userResponse.json.first_name, userResponse.json.last_name].filter(Boolean).join(" "),
      },
    })
  } catch (error) {
    e.app.logger().warn("Zoom connection check failed", "error", String(error))
    return e.json(200, {
      provider: "zoom",
      configured: true,
      connected: false,
      reason: "network_error",
    })
  }
}, $apis.requireAuth("users"))
