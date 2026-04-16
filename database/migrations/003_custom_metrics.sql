-- Migration 003: Custom Metric Definitions
-- Adds support for user-defined custom metrics beyond the standard CFV formula.
-- custom_metrics_definitions: describes a metric type (name, unit, description)
-- custom_metric_values: stores actual values per coin per metric definition

-- Custom metric definitions table
CREATE TABLE IF NOT EXISTS custom_metrics_definitions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    unit VARCHAR(50),
    formula TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name),
    INDEX idx_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Custom metric values table (one value per coin per definition)
CREATE TABLE IF NOT EXISTS custom_metric_values (
    id INT PRIMARY KEY AUTO_INCREMENT,
    definition_id INT NOT NULL,
    coin_id INT NOT NULL,
    value DECIMAL(30, 8) NOT NULL,
    metadata JSON,
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (definition_id) REFERENCES custom_metrics_definitions(id) ON DELETE CASCADE,
    FOREIGN KEY (coin_id) REFERENCES coins(id) ON DELETE CASCADE,
    INDEX idx_definition_coin (definition_id, coin_id),
    INDEX idx_collected_at (collected_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
