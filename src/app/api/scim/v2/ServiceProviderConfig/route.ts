import { authenticateScim, scimJson } from "@/lib/scim/http";
import { SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA } from "@/lib/scim/schema";

/** SCIM 2.0 ServiceProviderConfig — advertises the features we support. */
export async function GET(request: Request) {
  const auth = await authenticateScim(request);
  if (!auth.ok) return auth.response;

  return scimJson({
    schemas: [SCIM_SERVICE_PROVIDER_CONFIG_SCHEMA],
    documentationUri: "https://docs.comply-quick.com/enterprise/scim",
    patch: { supported: true },
    bulk: { supported: false, maxOperations: 0, maxPayloadSize: 0 },
    filter: { supported: true, maxResults: 200 },
    changePassword: { supported: false },
    sort: { supported: false },
    etag: { supported: false },
    authenticationSchemes: [
      {
        type: "oauthbearertoken",
        name: "OAuth Bearer Token",
        description: "Authentication via the SCIM bearer token issued in Comply-Quick.",
        primary: true,
      },
    ],
    meta: { resourceType: "ServiceProviderConfig" },
  });
}
