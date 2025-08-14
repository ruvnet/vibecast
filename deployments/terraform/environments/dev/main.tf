# Development Environment Configuration

terraform {
  backend "s3" {
    bucket         = "vibecast-terraform-state-dev"
    key            = "dev/terraform.tfstate"
    region         = "us-west-2"
    encrypt        = true
    dynamodb_table = "terraform-locks-dev"
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
  environment = "dev"
  aws_region  = "us-west-2"

  # VPC Configuration
  vpc_cidr               = "10.0.0.0/16"
  availability_zones     = ["us-west-2a", "us-west-2b"]
  private_subnet_cidrs   = ["10.0.1.0/24", "10.0.2.0/24"]
  public_subnet_cidrs    = ["10.0.101.0/24", "10.0.102.0/24"]
  database_subnet_cidrs  = ["10.0.201.0/24", "10.0.202.0/24"]

  # EKS Configuration
  cluster_version = "1.28"
  node_groups = {
    general = {
      instance_types = ["t3.small"]
      min_size       = 1
      max_size       = 3
      desired_size   = 1
      capacity_type  = "ON_DEMAND"
    }
  }

  # RDS Configuration (smaller instances for dev)
  db_instance_class     = "db.t3.micro"
  db_allocated_storage  = 20
  db_engine_version     = "15.4"

  # ElastiCache Configuration
  redis_node_type       = "cache.t3.micro"
  redis_num_cache_nodes = 1
  redis_engine_version  = "7.0"

  # Application Configuration
  image_tag = "develop"
  domain_name = "dev.vibecast.example.com"

  # Feature toggles
  enable_monitoring = false
  enable_logging    = true
}