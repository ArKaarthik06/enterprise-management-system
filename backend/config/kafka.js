const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'enterprise-marketplace',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
});

const producer = kafka.producer();

const connectKafkaProducer = async () => {
  try {
    await producer.connect();
    console.log('Kafka Producer connected');
  } catch (err) {
    console.error('Error connecting Kafka producer', err);
  }
};

const publishEvent = async (topic, key, message) => {
  try {
    await producer.send({
      topic,
      messages: [
        { key: String(key), value: JSON.stringify(message) }
      ],
    });
  } catch (err) {
    console.error(`Failed to publish event to topic ${topic}`, err);
    // Dead-letter queue / retry logic can be expanded here
  }
};

module.exports = {
  kafka,
  producer,
  connectKafkaProducer,
  publishEvent
};
