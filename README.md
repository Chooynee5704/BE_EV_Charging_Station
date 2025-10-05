docker build -t chooyy5704/ev-charging-management:latest .

$USER="your-dockerhub-username"
$REPO="nodejs-backend-api"
$VER="1.0.0"

docker login

docker tag ev-charging-management:latest chooyy5704/ev-charging-management:latest

docker push chooyy5704/ev-charging-management:latest
