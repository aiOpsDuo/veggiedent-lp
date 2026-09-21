-- CreateTable
CREATE TABLE `content_sections` (
    `key` VARCHAR(64) NOT NULL,
    `data` JSON NOT NULL,
    `is_published` BOOLEAN NOT NULL DEFAULT false,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_by` CHAR(36) NULL,

    PRIMARY KEY (`key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `site_metadata` (
    `id` VARCHAR(16) NOT NULL DEFAULT 'default',
    `title` TEXT NULL,
    `description` TEXT NULL,
    `og_image_alt` TEXT NULL,
    `og_image_media_id` CHAR(36) NULL,
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_by` CHAR(36) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media_assets` (
    `id` CHAR(36) NOT NULL,
    `kind` VARCHAR(16) NOT NULL,
    `storage_path` VARCHAR(512) NOT NULL,
    `public_url` VARCHAR(1024) NOT NULL,
    `mime_type` VARCHAR(255) NOT NULL,
    `size_bytes` BIGINT NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `duration_seconds` DECIMAL(10, 3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` CHAR(36) NULL,

    UNIQUE INDEX `media_assets_storage_path_key`(`storage_path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` CHAR(36) NOT NULL,
    `nome` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `telefone` VARCHAR(255) NULL,
    `nome_cachorro` VARCHAR(255) NULL,
    `porte_cachorro` VARCHAR(255) NULL,
    `cidade_estado` VARCHAR(255) NULL,
    `conhece_virbac` VARCHAR(255) NULL,
    `usa_produto_virbac` VARCHAR(255) NULL,
    `qual_produto_virbac` VARCHAR(255) NULL,
    `aceite_comunicacoes` BOOLEAN NOT NULL,
    `origem` VARCHAR(64) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `leads_created_at_desc_idx`(`created_at` DESC),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operators` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `operators_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `site_metadata` ADD CONSTRAINT `site_metadata_og_image_media_id_fkey` FOREIGN KEY (`og_image_media_id`) REFERENCES `media_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
