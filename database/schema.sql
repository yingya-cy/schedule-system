CREATE DATABASE IF NOT EXISTS schedule_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE schedule_system;

CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  department VARCHAR(100) NOT NULL,
  filename VARCHAR(255),
  file_data LONGBLOB,
  file_type VARCHAR(100),
  storage_type ENUM('database', 'filesystem', 'object_storage') DEFAULT 'database',
  file_path VARCHAR(500),
  file_size BIGINT DEFAULT 0,
  file_hash VARCHAR(64),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_department (department),
  INDEX idx_name (name),
  INDEX idx_storage_type (storage_type),
  INDEX idx_file_hash (file_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  course_name VARCHAR(200) NOT NULL,
  weekday INT NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  sections JSON NOT NULL,
  weeks JSON NOT NULL,
  teacher VARCHAR(100),
  location VARCHAR(100),
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  INDEX idx_schedule_id (schedule_id),
  INDEX idx_weekday (weekday)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO departments (name, sort_order) VALUES 
('主任团', 1),
('网编部', 2),
('秘书部', 3),
('策划部', 4),
('咨询部', 5),
('外联部', 6),
('宣传部', 7)
ON DUPLICATE KEY UPDATE name=name;
