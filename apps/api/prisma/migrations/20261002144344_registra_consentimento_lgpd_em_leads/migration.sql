-- AlterTable
ALTER TABLE `leads` ADD COLUMN `aceite_lgpd` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `aceite_lgpd_em` DATETIME(3) NULL,
    ADD COLUMN `aceite_lgpd_politica_url` VARCHAR(500) NULL,
    ADD COLUMN `aceite_lgpd_texto` VARCHAR(500) NULL;

-- Backfill (escrito a mao): todo lead ja gravado aceitou a Politica de
-- Privacidade — a API sempre recusou com 422 o envio sem `aceite_lgpd` — e o
-- aceite aconteceu no instante do envio. O texto exibido e o endereco da
-- politica nao eram guardados e ficam NULL nas linhas antigas.
UPDATE `leads` SET `aceite_lgpd` = true, `aceite_lgpd_em` = `created_at` WHERE `aceite_lgpd` = false;
