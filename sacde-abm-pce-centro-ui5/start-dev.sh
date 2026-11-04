#!/bin/bash

# Cargar .env
export $(grep -v '^#' default.env | xargs)

# Obtener token (Basic Auth en vez de client_id/secret en el body)
TOKEN=$(curl -s -X POST \
  "https://workzone-dev-br-o3tw57nz.authentication.br10.hana.ondemand.com/oauth/token" \
  -u "$BTP_CLIENT_ID:$BTP_CLIENT_SECRET" \
  -d "grant_type=client_credentials" \
  | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).access_token))")

if [ -z "$TOKEN" ] || [ "$TOKEN" = "undefined" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Error obteniendo token. Verificá CLIENT_ID y CLIENT_SECRET en .env"
  exit 1
fi

echo "✅ Token obtenido: ${TOKEN:0:30}..."

# Reemplazar Bearer <lo que sea> por el token nuevo
sed -i "s|Bearer [^\"]*\"|Bearer $TOKEN\"|g" ui5.yaml

# Evitar el helper de BAS (localhost:3001) fuera de Business Application Studio
unset WS_BASE_URL

npx fiori run
