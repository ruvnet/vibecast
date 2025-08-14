# VPC Module
module "vpc" {
  source = "./modules/vpc"
  
  project_name             = var.project_name
  environment             = var.environment
  vpc_cidr                = var.vpc_cidr
  availability_zones      = var.availability_zones
  private_subnet_cidrs    = var.private_subnet_cidrs
  public_subnet_cidrs     = var.public_subnet_cidrs
  database_subnet_cidrs   = var.database_subnet_cidrs
  
  tags = local.common_tags
}

# Security Groups Module
module "security" {
  source = "./modules/security"
  
  project_name = var.project_name
  environment  = var.environment
  vpc_id       = module.vpc.vpc_id
  vpc_cidr     = var.vpc_cidr
  
  tags = local.common_tags
}

# EKS Module
module "eks" {
  source = "./modules/eks"
  
  project_name           = var.project_name
  environment           = var.environment
  cluster_version       = var.cluster_version
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  public_subnet_ids     = module.vpc.public_subnet_ids
  node_groups           = var.node_groups
  
  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "./modules/rds"
  
  project_name           = var.project_name
  environment           = var.environment
  vpc_id                = module.vpc.vpc_id
  database_subnet_ids   = module.vpc.database_subnet_ids
  security_group_ids    = [module.security.database_security_group_id]
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  engine_version        = var.db_engine_version
  
  tags = local.common_tags
}

# ElastiCache Module
module "elasticache" {
  source = "./modules/elasticache"
  
  project_name        = var.project_name
  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  security_group_ids = [module.security.redis_security_group_id]
  node_type          = var.redis_node_type
  num_cache_nodes    = var.redis_num_cache_nodes
  engine_version     = var.redis_engine_version
  
  tags = local.common_tags
}

# Application Load Balancer Module
module "alb" {
  source = "./modules/alb"
  
  project_name         = var.project_name
  environment         = var.environment
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  security_group_ids  = [module.security.alb_security_group_id]
  certificate_arn     = var.certificate_arn
  
  tags = local.common_tags
}

# Secrets Manager Module
module "secrets" {
  source = "./modules/secrets"
  
  project_name = var.project_name
  environment  = var.environment
  
  tags = local.common_tags
}

# ECR Module
module "ecr" {
  source = "./modules/ecr"
  
  project_name = var.project_name
  environment  = var.environment
  
  tags = local.common_tags
}

# Monitoring Module (Optional)
module "monitoring" {
  source = "./modules/monitoring"
  count  = var.enable_monitoring ? 1 : 0
  
  project_name    = var.project_name
  environment     = var.environment
  cluster_name    = local.cluster_name
  
  tags = local.common_tags
}