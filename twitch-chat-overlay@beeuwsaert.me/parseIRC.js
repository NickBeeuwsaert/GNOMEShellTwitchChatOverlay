function parseMessage(rawMessage) {
  const length = rawMessage.length;
  let position = 0;
  let message = {
    raw: rawMessage,
    tags: {},
    prefix: null,
    command: null,
    params: [],
  };

  const skipWhitespace = () => {
    // skip whitespace
    while (position < length) {
      if (rawMessage[position] !== " ") break;
      position += 1;
    }
  };

  // check for message tags
  if (rawMessage[position] === "@") {
    const tagEnd = rawMessage.indexOf(" ", position);
    if (tagEnd === -1) throw new Error("Malformed tags");

    const tags = rawMessage.slice(1, tagEnd).split(";");

    for (const tag of tags) {
      if (tag.includes("=")) {
        const [key, value] = tag.split("=");
        message.tags[key] = value;
      } else {
        message.tags[tag] = true;
      }
    }

    position = tagEnd + 1;
  }

  skipWhitespace();

  // Parse out the prefix, if there is one
  if (rawMessage[position] === ":") {
    const prefixEnd = rawMessage.indexOf(" ", position);

    if (prefixEnd === -1) throw new Error("Malformed prefix");

    message.prefix = rawMessage.slice(position + 1, prefixEnd);

    position = prefixEnd + 1;

    skipWhitespace();
  }

  const commandSpace = rawMessage.indexOf(" ", position);
  if (commandSpace === -1) {
    if (position < length) {
      // there is more data, but no space, so treat the remaining data as the command
      message.command = rawMessage.slice(position);
    }

    throw Error("Expected command");
  }

  message.command = rawMessage.slice(position, commandSpace);

  position = commandSpace + 1;

  skipWhitespace();

  while (position < length) {
    const nextSpace = rawMessage.indexOf(" ", position);
    if (rawMessage[position] === ":") {
      message.params.push(rawMessage.slice(position + 1));
      break;
    }

    if (nextSpace !== -1) {
      message.params.push(rawMessage.slice(position, nextSpace));
      position = nextSpace + 1;

      skipWhitespace();
    } else {
      message.params.push(rawMessage.slice(position));
      break;
    }
  }

  return message;
}
