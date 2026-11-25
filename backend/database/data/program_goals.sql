-- Reference data: program_goals
-- The main goals beneficiaries choose from in the pre-assessment.
--
-- Starting data every copy of iELEVATE needs. It's already in
-- ..\setup_fresh_database.sql; import tables\program_goals.sql first if you use this file on its own.

INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (1,'job','Get hired for an office or BPO job',NULL);
INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (2,'freelance','Work from home as a freelancer or virtual assistant',NULL);
INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (3,'business','Start or grow my own online business',NULL);
INSERT INTO `program_goals` (`id`, `value`, `label`, `start_phase`) VALUES (4,'undecided','Not sure yet',1);
