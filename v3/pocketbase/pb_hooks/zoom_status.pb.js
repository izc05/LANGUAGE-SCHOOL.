/// <reference path="../pb_data/types.d.ts" />

routerAdd("GET", "/api/language-school/zoom/status", (e) => {
  if (!e.auth || e.auth.get("role") !== "ADMIN") {
    throw new ForbiddenError("Solo Administración puede consultar el estado de Zoom.")
  }

  const accountId = $os.getenv("ZOOM_ACCOUNT_ID")
  const apiClientId = $os.getenv("ZOOM_CLIENT_ID")
  const apiClientSecret = $os.getenv("ZOOM_CLIENT_SECRET")
  const sdkClientId = $os.getenv("ZOOM_MEETING_SDK_CLIENT_ID")
  const sdkClientSecret = $os.getenv("ZOOM_MEETING_SDK_CLIENT_SECRET")

  const apiConfigured = Boolean(accountId && apiClientId && apiClientSecret)
  const meetingSdkConfigured = Boolean(sdkClientId && sdkClientSecret)

  return e.json(200, {
    provider: "zoom",
    source: "server_environment",
    apiConfigured,
    meetingSdkConfigured,
    configured: apiConfigured && meetingSdkConfigured,
  })
}, $apis.requireAuth("users"))
