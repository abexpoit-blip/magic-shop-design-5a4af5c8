-- Fix swapped country/state values in cards table.
-- If 'state' contains a known 2-letter country code and 'country' doesn't,
-- swap them. Known country codes list (common ones):
UPDATE cards
SET country = state, state = country
WHERE length(state) = 2
  AND state IN (
    'US','CA','GB','UK','AU','DE','FR','IT','ES','BR','MX','JP','CN','IN','RU',
    'KR','NL','BE','SE','NO','DK','FI','AT','CH','PL','PT','CZ','IE','NZ',
    'ZA','AR','CL','CO','PE','VE','SG','MY','TH','PH','VN','ID','TW','HK',
    'AE','SA','QA','KW','EG','NG','KE','IL','TR','UA','RO','HU','GR','BG',
    'HR','SK','SI','LT','LV','EE','IS','LU','MT','CY','PR','DO','JM','TT',
    'PA','CR','GT','EC','UY','PY','BO'
  )
  AND (country IS NULL OR length(country) > 2 OR country NOT IN (
    'US','CA','GB','UK','AU','DE','FR','IT','ES','BR','MX','JP','CN','IN','RU',
    'KR','NL','BE','SE','NO','DK','FI','AT','CH','PL','PT','CZ','IE','NZ',
    'ZA','AR','CL','CO','PE','VE','SG','MY','TH','PH','VN','ID','TW','HK',
    'AE','SA','QA','KW','EG','NG','KE','IL','TR','UA','RO','HU','GR','BG',
    'HR','SK','SI','LT','LV','EE','IS','LU','MT','CY','PR','DO','JM','TT',
    'PA','CR','GT','EC','UY','PY','BO'
  ));
