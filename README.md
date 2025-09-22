docker build -t chooyy5704/ev-charging-management:latest .

docker run --rm --init -p 3000:3000 -e NODE_ENV=production -e PORT=3000 -e DATABASE_TYPE=mongodb -e MONGODB_URI="mongodb+srv://maintpse184343_db_user:Imchooyvkev5704@evchargingstation.4gzwomn.mongodb.net/?retryWrites=true&w=majority&appName=EVChargingStation" -e SWAGGER_SERVER_URL="/" ev-charging-management:latest

$USER="your-dockerhub-username"
$REPO="nodejs-backend-api"
$VER="1.0.0"

docker login

docker tag ev-charging-management:latest chooyy5704/ev-charging-management:latest

docker push chooyy5704/ev-charging-management:latest
