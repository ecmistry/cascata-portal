-- Create sync_state table
CREATE TABLE IF NOT EXISTS sync_state (
  id INT AUTO_INCREMENT PRIMARY KEY,
  object_type VARCHAR(50) NOT NULL UNIQUE,
  last_sync_timestamp BIGINT,
  last_sync_date DATETIME,
  status VARCHAR(20) NOT NULL DEFAULT 'success',
  records_synced INT DEFAULT 0,
  error_message TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create hubspot_contacts table
CREATE TABLE IF NOT EXISTS hubspot_contacts (
  id VARCHAR(50) PRIMARY KEY,
  email VARCHAR(255),
  firstname VARCHAR(255),
  lastname VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  website VARCHAR(255),
  lifecyclestage VARCHAR(100),
  jobtitle VARCHAR(255),
  createdate DATETIME,
  lastmodifieddate DATETIME,
  hs_lastmodifieddate BIGINT,
  properties_json JSON,
  synced_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX email_idx (email),
  INDEX lastmodified_idx (lastmodifieddate),
  INDEX hs_lastmodified_idx (hs_lastmodifieddate)
);

-- Create hubspot_deals table
CREATE TABLE IF NOT EXISTS hubspot_deals (
  id VARCHAR(50) PRIMARY KEY,
  dealname VARCHAR(255),
  dealstage VARCHAR(100),
  pipeline VARCHAR(100),
  amount DECIMAL(15, 2),
  closedate DATETIME,
  createdate DATETIME,
  lastmodifieddate DATETIME,
  hs_lastmodifieddate BIGINT,
  hubspot_owner_id VARCHAR(50),
  dealtype VARCHAR(100),
  properties_json JSON,
  synced_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX dealstage_idx (dealstage),
  INDEX pipeline_idx (pipeline),
  INDEX lastmodified_idx (lastmodifieddate),
  INDEX hs_lastmodified_idx (hs_lastmodifieddate)
);

-- Create hubspot_deal_pipelines table
CREATE TABLE IF NOT EXISTS hubspot_deal_pipelines (
  id VARCHAR(50) PRIMARY KEY,
  label VARCHAR(255) NOT NULL,
  display_order INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at_hubspot DATETIME,
  updated_at_hubspot DATETIME,
  synced_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create hubspot_deal_stages table
CREATE TABLE IF NOT EXISTS hubspot_deal_stages (
  id VARCHAR(50) PRIMARY KEY,
  pipeline_id VARCHAR(50) NOT NULL,
  label VARCHAR(255) NOT NULL,
  display_order INT NOT NULL,
  metadata_json JSON,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at_hubspot DATETIME,
  updated_at_hubspot DATETIME,
  synced_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX pipeline_idx (pipeline_id)
);

-- Create deal_stage table (separate structure for portal queries)
CREATE TABLE IF NOT EXISTS deal_stage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  deal_id VARCHAR(50) NOT NULL,
  stage_id VARCHAR(50),
  value VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX deal_idx (deal_id),
  INDEX stage_idx (stage_id)
);




