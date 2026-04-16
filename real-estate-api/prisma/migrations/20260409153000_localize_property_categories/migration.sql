UPDATE `property_categories`
SET `name` = CASE `category_code`
    WHEN 'HOUSE' THEN 'Nhà ở'
    WHEN 'VILLA' THEN 'Biệt thự'
    WHEN 'APARTMENT' THEN 'Chung cư'
    WHEN 'TOWNHOUSE' THEN 'Nhà phố'
    WHEN 'RESLAND' THEN 'Đất ở'
    WHEN 'COMLAND' THEN 'Đất thương mại'
    WHEN 'AGRLAND' THEN 'Đất nông nghiệp'
    WHEN 'INDLAND' THEN 'Đất công nghiệp'
    ELSE `name`
END
WHERE `category_code` IN (
    'HOUSE',
    'VILLA',
    'APARTMENT',
    'TOWNHOUSE',
    'RESLAND',
    'COMLAND',
    'AGRLAND',
    'INDLAND'
);