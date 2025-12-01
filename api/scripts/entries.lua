local cursor = "0";
local result = {};
repeat
    local chunk = redis.call("SCAN", cursor, "MATCH", KEYS[1], "COUNT", 10);
    cursor = chunk[1];
    for _, key in ipairs(chunk[2]) do
        local type = redis.call("TYPE", key).ok
        local ttl = redis.call("TTL", key)
        local size = "?"

        if type == "string" then
            size = redis.call("STRLEN", key)
        elseif type == "hash" then
            size = redis.call("HLEN", key)
        elseif type == "list" then
            size = redis.call("LLEN", key)
        elseif type == "set" then
            size = redis.call("SCARD", key)
        elseif type == "zset" then
            size = redis.call("ZCOUNT", key, "-inf", "+inf")
        elseif type == "stream" then
            size = redis.call("XLEN", key)
        end

        result[#result + 1] = {key, type, ttl, size};
    end;
until cursor == "0";
return result;
