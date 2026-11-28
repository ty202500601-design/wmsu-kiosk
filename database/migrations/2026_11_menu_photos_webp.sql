USE wmsu_canteen;

ALTER TABLE foods
  ADD COLUMN IF NOT EXISTS image_path VARCHAR(255) NULL DEFAULT NULL AFTER image,
  ADD COLUMN IF NOT EXISTS thumb_path VARCHAR(255) NULL DEFAULT NULL AFTER image_path;

UPDATE foods SET image_path = 'uploads/menu/2/1-tapsilog.webp',       thumb_path = 'uploads/menu/2/1-tapsilog-thumb.webp'       WHERE id = 1;
UPDATE foods SET image_path = 'uploads/menu/2/2-chicken-adobo.webp',  thumb_path = 'uploads/menu/2/2-chicken-adobo-thumb.webp'  WHERE id = 2;
UPDATE foods SET image_path = 'uploads/menu/2/3-pork-sinigang.webp',  thumb_path = 'uploads/menu/2/3-pork-sinigang-thumb.webp'  WHERE id = 3;
UPDATE foods SET image_path = 'uploads/menu/2/4-iced-tea.webp',       thumb_path = 'uploads/menu/2/4-iced-tea-thumb.webp'       WHERE id = 4;
UPDATE foods SET image_path = 'uploads/menu/3/5-cheeseburger.webp',   thumb_path = 'uploads/menu/3/5-cheeseburger-thumb.webp'   WHERE id = 5;
UPDATE foods SET image_path = 'uploads/menu/3/6-double-burger.webp',  thumb_path = 'uploads/menu/3/6-double-burger-thumb.webp'  WHERE id = 6;
UPDATE foods SET image_path = 'uploads/menu/3/7-french-fries.webp',   thumb_path = 'uploads/menu/3/7-french-fries-thumb.webp'   WHERE id = 7;
UPDATE foods SET image_path = 'uploads/menu/3/8-soda.webp',           thumb_path = 'uploads/menu/3/8-soda-thumb.webp'           WHERE id = 8;
