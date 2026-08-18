function q(code, level, prompt, passage, options, correct) {
  return { code, skill: 'LISTENING', level, prompt, passage, options: options.map((label, index) => ({ id: String.fromCharCode(97 + index), label })), correct, explanation: 'Listening diagnostic item.' }
}
module.exports = [
  q('li-a1-01','A1','Where is the speaker going?',"I'm going to the supermarket to buy some bread and milk.",['To the supermarket','To the hospital','To the station','To the cinema'],'a'),
  q('li-a1-02','A1','What time does the class start?',"Our English class starts at nine o'clock on Tuesday morning.",['At eight','At nine','At ten','At eleven'],'b'),
  q('li-a1-03','A1','What does the woman want to drink?',"Can I have a glass of water, please? I don't want coffee today.",['Coffee','Tea','Water','Juice'],'c'),
  q('li-a1-04','A1','How many brothers does Leo have?','My name is Leo. I have two sisters and one brother.',['None','Two','Three','One'],'d'),
  q('li-a2-01','A2','Why is Marta taking a taxi?','Marta normally walks to work, but it is raining heavily and she has an important meeting in twenty minutes, so she is taking a taxi.',['She is late for a meeting','Her car is new','She dislikes walking','The bus is free'],'a'),
  q('li-a2-02','A2','What should guests bring?',"We're having a picnic in the park on Sunday. We'll bring the food, but please bring something to sit on.",['Food','A blanket or mat','A bicycle','A camera'],'b'),
  q('li-a2-03','A2','What changed about the appointment?',"Your dentist appointment is still on Thursday, but it has moved from ten o'clock to half past eleven.",['The dentist','The day','The time','The clinic'],'c'),
  q('li-a2-04','A2','Where should the passenger get off?','Take bus number twelve and get off at the stop after the library. The museum is opposite that stop.',['At the station','Before the library','At the library','After the library'],'d'),
]
