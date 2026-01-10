#!/bin/bash

# =========================================
# WatchMe Business API - Production Deployment Script
# =========================================

set -e  # Exit immediately on error

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Container configuration
CONTAINER_NAME="watchme-business-api"
ECR_REGISTRY="754724220380.dkr.ecr.ap-southeast-2.amazonaws.com"
ECR_REPOSITORY="watchme-business"
AWS_REGION="ap-southeast-2"

echo -e "${GREEN}🚀 WatchMe Business API - Production Deployment${NC}"
echo "========================================"
echo ""

# Step 1: Login to ECR
echo -e "${BLUE}🔑 Step 1: Logging into ECR...${NC}"
aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${ECR_REGISTRY}
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ ECR login successful${NC}"
else
    echo -e "${RED}❌ ECR login failed${NC}"
    exit 1
fi
echo ""

# Step 2: Pull latest image from ECR
echo -e "${BLUE}📥 Step 2: Pulling latest image from ECR...${NC}"
docker pull ${ECR_REGISTRY}/${ECR_REPOSITORY}:latest
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image pull successful${NC}"
else
    echo -e "${RED}❌ Image pull failed${NC}"
    exit 1
fi
echo ""

# Step 3: Remove existing containers
echo -e "${BLUE}🗑️  Step 3: Removing existing containers...${NC}"

# Stop running containers
echo "  📦 Searching for running containers..."
RUNNING_CONTAINERS=$(docker ps -q --filter "name=${CONTAINER_NAME}")
if [ ! -z "$RUNNING_CONTAINERS" ]; then
    echo "  ⏸️  Stopping running containers..."
    docker stop $RUNNING_CONTAINERS
    echo -e "  ${GREEN}✅ Containers stopped${NC}"
else
    echo "  ℹ️  No running containers found"
fi

# Remove all containers
echo "  📦 Removing all containers..."
ALL_CONTAINERS=$(docker ps -aq --filter "name=${CONTAINER_NAME}")
if [ ! -z "$ALL_CONTAINERS" ]; then
    echo "  🗑️  Removing containers..."
    docker rm -f $ALL_CONTAINERS
    echo -e "  ${GREEN}✅ Containers removed${NC}"
else
    echo "  ℹ️  No containers to remove"
fi

# Remove docker-compose managed containers
echo "  📦 Removing docker-compose managed containers..."
docker-compose -f docker-compose.prod.yml down || true
echo -e "${GREEN}✅ Container removal complete${NC}"
echo ""

# Step 4: Start new container
echo -e "${BLUE}🚀 Step 4: Starting new container...${NC}"
docker-compose -f docker-compose.prod.yml up -d
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Container started successfully${NC}"
else
    echo -e "${RED}❌ Container start failed${NC}"
    exit 1
fi
echo ""

# Step 5: Wait for container startup
echo -e "${BLUE}⏳ Step 5: Waiting for container startup...${NC}"
sleep 5
echo -e "${GREEN}✅ Wait complete${NC}"
echo ""

# Step 6: Check container status
echo -e "${BLUE}📊 Step 6: Checking container status...${NC}"
CONTAINER_STATUS=$(docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}")
if [ ! -z "$CONTAINER_STATUS" ]; then
    echo "$CONTAINER_STATUS"
    echo -e "${GREEN}✅ Container is running normally${NC}"
else
    echo -e "${RED}❌ Container not found${NC}"
    echo "Check logs:"
    docker logs ${CONTAINER_NAME} --tail 50
    exit 1
fi
echo ""

# Step 7: Health check
echo -e "${BLUE}🏥 Step 7: Running health check...${NC}"
echo "Retrying for up to 60 seconds (12 attempts × 5 seconds)..."

for i in {1..12}; do
    if curl -f http://localhost:8052/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Health check passed (attempt $i/12)${NC}"
        echo ""

        # Show health check details
        echo "📊 Health check details:"
        curl -s http://localhost:8052/health | python3 -m json.tool || echo "{}"
        echo ""

        # Final result
        echo "========================================"
        echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
        echo "========================================"
        echo ""
        echo "📦 Container name: ${CONTAINER_NAME}"
        echo "🌐 Local URL: http://localhost:8052"
        echo "🌐 Production URL: https://api.hey-watch.me/business/"
        echo "📋 Check logs: docker logs ${CONTAINER_NAME} -f"
        echo ""
        exit 0
    fi

    echo -e "${YELLOW}  Attempt $i/12 failed, retrying in 5 seconds...${NC}"
    sleep 5
done

# Health check failed
echo -e "${RED}❌ Health check failed${NC}"
echo ""
echo "Debug information:"
echo "------------"
echo "Container logs (last 50 lines):"
docker logs ${CONTAINER_NAME} --tail 50
echo ""
echo "Container status:"
docker ps -a --filter "name=${CONTAINER_NAME}"
echo ""
echo "Troubleshooting:"
echo "1. Check logs: docker logs ${CONTAINER_NAME} -f"
echo "2. Verify .env file environment variables"
echo "3. Verify S3 and Supabase credentials"

exit 1