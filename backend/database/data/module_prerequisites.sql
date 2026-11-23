-- Reference data: module_prerequisites
-- Which modules a module needs first.
--
-- Starting data every copy of iELEVATE needs. It's already in
-- ..\setup_fresh_database.sql; import tables\module_prerequisites.sql first if you use this file on its own.

INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (96,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (97,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (98,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (101,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (102,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (102,100);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (103,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (104,95);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (104,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,96);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,98);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,99);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (105,100);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (118,117);
INSERT INTO `module_prerequisites` (`module_id`, `prerequisite_id`) VALUES (119,117);
