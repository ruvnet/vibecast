# Staging Environment Configuration

terraform {
  backend "s3" {
    bucket         = "vibecast-terraform-state-staging"
    key            = "staging/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-locks-staging"
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
  environment = "staging"
  aws_region  = "us-west-2"

  # VPC Configuration
  vpc_cidr               = "10.1.0.0/16"
  availability_zones     = ["us-west-2a", "us-west-2b", "us-west-2c"]
  private_subnet_cidrs   = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnet_cidrs    = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]
  database_subnet_cidrs  = ["10.1.201.0/24", "10.1.202.0/24", "10.1.203.0/24"]

  # EKS Configuration
  cluster_version = "1.28"
  node_groups = {
    general = {
      instance_types = ["t3.medium"]
      min_size       = 2
      max_size       = 5
      desired_size   = 2
      capacity_type  = "ON_DEMAND"
    }
  }

  # RDS Configuration
  db_instance_class     = "db.t3.small"
  db_allocated_storage  = 50
  db_engine_version     = "15.4"

  # ElastiCache Configuration
  redis_node_type       = "cache.t3.small"
  redis_num_cache_nodes = 2
  redis_engine_version  = "7.0"

  # Application Configuration
  image_tag = "staging"
  domain_name = "staging.vibecast.example.com"

  # Feature toggles
  enable_monitoring = true
  enable_logging    = true
}