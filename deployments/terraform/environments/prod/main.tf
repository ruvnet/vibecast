# Production Environment Configuration

terraform {
  backend "s3" {
    bucket         = "vibecast-terraform-state-prod"
    key            = "prod/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-locks-prod"
  }
}

# Configure providers
provider "aws" {
  region = "us-west-2"
}

# Use the main module
module "infrastructure" {
  source = "../../"

  # Environment specific variables
  environment = "prod"
  aws_region  = "us-west-2"

  # VPC Configuration
  vpc_cidr               = "10.2.0.0/16"
  availability_zones     = ["us-west-2a", "us-west-2b", "us-west-2c"]
  private_subnet_cidrs   = ["10.2.1.0/24", "10.2.2.0/24", "10.2.3.0/24"]
  public_subnet_cidrs    = ["10.2.101.0/24", "10.2.102.0/24", "10.2.103.0/24"]
  database_subnet_cidrs  = ["10.2.201.0/24", "10.2.202.0/24", "10.2.203.0/24"]

  # EKS Configuration
  cluster_version = "1.28"
  node_groups = {
    general = {
      instance_types = ["m5.large"]
      min_size       = 3
      max_size       = 20
      desired_size   = 5
      capacity_type  = "ON_DEMAND"
    }
    spot = {
      instance_types = ["m5.large", "m5.xlarge", "m4.large"]
      min_size       = 0
      max_size       = 10
      desired_size   = 2
      capacity_type  = "SPOT"
    }
  }

  # RDS Configuration (Multi-AZ for production)
  db_instance_class     = "db.r5.large"
  db_allocated_storage  = 200
  db_engine_version     = "15.4"

  # ElastiCache Configuration (Cluster mode for production)
  redis_node_type       = "cache.r5.large"
  redis_num_cache_nodes = 3
  redis_engine_version  = "7.0"

  # Application Configuration
  image_tag = "v1.0.0"
  domain_name = "vibecast.example.com"
  certificate_arn = "arn:aws:acm:us-west-2:123456789012:certificate/abcd1234-efgh-5678-ijkl-9012mnop3456"

  # Feature toggles
  enable_monitoring = true
  enable_logging    = true
}