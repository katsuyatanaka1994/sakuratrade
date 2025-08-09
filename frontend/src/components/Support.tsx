import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Label } from '@/components/UI/label';
import { Textarea } from '@/components/UI/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/UI/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/UI/accordion';
import { ArrowLeft, Search } from 'lucide-react';

export default function Support() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [contactForm, setContactForm] = useState({
    subject: '',
    message: ''
  });

  const faqItems = [
    {
      id: 'faq-1',
      question: 'チャート分析の精度はどの程度ですか？',
      answer: 'AI分析の精度は約85%です。ただし、市場の突発的な変動には対応できない場合があります。最終的な投資判断はお客様ご自身で行ってください。'
    },
    {
      id: 'faq-2',
      question: '/buy /sell コマンドの使い方を教えてください',
      answer: '/buy [銘柄コード] [数量] [価格] の形式で入力してください。例: /buy 9984 100 7920。売却時は /sell を使用します。'
    },
    {
      id: 'faq-3',
      question: 'デイトレードとスイングトレードの判定基準は？',
      answer: 'ポジション保有時間が当日内ならデイトレード、翌日以降にまたがる場合はスイングトレードとして分類されます。'
    },
    {
      id: 'faq-4',
      question: 'AIの推奨に従って損失が出た場合の補償は？',
      answer: 'AIの推奨は参考情報であり、投資判断はお客様の責任となります。損失に対する補償は行っておりません。'
    },
    {
      id: 'faq-5',
      question: 'リアルタイムデータの遅延はありますか？',
      answer: 'リアルタイムデータは約15秒の遅延があります。超高頻度取引には適していません。'
    },
    {
      id: 'faq-6',
      question: 'プランのアップグレード・ダウングレードは可能ですか？',
      answer: 'はい、いつでもプラン変更が可能です。アップグレードは即座に反映され、ダウングレードは次回更新時に適用されます。'
    },
    {
      id: 'faq-7',
      question: 'データのエクスポート機能はありますか？',
      answer: 'Premiumプランでは、取引履歴とレポートをCSV形式でエクスポートできます。'
    },
    {
      id: 'faq-8',
      question: 'スマートフォンアプリはありますか？',
      answer: '現在はWebアプリのみの提供となります。モバイルアプリは2024年春のリリースを予定しています。'
    }
  ];

  const filteredFAQ = faqItems.filter(item =>
    item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.answer.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmitContact = (e: React.FormEvent) => {
    e.preventDefault();
    // Submit contact form logic
    console.log('Contact form submitted:', contactForm);
    // Reset form
    setContactForm({ subject: '', message: '' });
    // Show success message
    alert('お問い合わせを送信しました。2-3営業日以内にご回答いたします。');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            ダッシュボード
          </Button>
          <span className="text-xl font-bold">サポート</span>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-8 py-8">
        <div className="grid grid-cols-12 gap-8">
          {/* FAQ Section (65%) */}
          <div className="col-span-8">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>よくある質問</CardTitle>
                
                {/* Search Bar */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="質問を検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12 rounded-lg"
                  />
                </div>
              </CardHeader>
              
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {filteredFAQ.map((item) => (
                    <AccordionItem key={item.id} value={item.id}>
                      <AccordionTrigger className="text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent>
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                
                {filteredFAQ.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    検索条件に一致する質問が見つかりませんでした。
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contact Form (35%) */}
          <div className="col-span-4">
            <Card className="rounded-xl shadow-sm">
              <CardHeader>
                <CardTitle>お問い合わせ</CardTitle>
              </CardHeader>
              
              <CardContent>
                <form onSubmit={handleSubmitContact} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="subject">件名</Label>
                    <Input
                      id="subject"
                      value={contactForm.subject}
                      onChange={(e) => setContactForm({
                        ...contactForm, 
                        subject: e.target.value
                      })}
                      className="h-12"
                      placeholder="お問い合わせの件名"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="message">お問い合わせ内容</Label>
                    <Textarea
                      id="message"
                      value={contactForm.message}
                      onChange={(e) => setContactForm({
                        ...contactForm, 
                        message: e.target.value
                      })}
                      placeholder="詳しい内容をお書きください..."
                      className="min-h-[120px]"
                      required
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full h-12"
                    style={{ backgroundColor: '#5ED0E8' }}
                  >
                    送信
                  </Button>
                </form>

                <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                  <h4 className="font-medium mb-2">お問い合わせについて</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• 回答まで2-3営業日いただきます</li>
                    <li>• 緊急時は電話サポートをご利用ください</li>
                    <li>• Premiumプランは優先対応いたします</li>
                  </ul>
                </div>

                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-600">電話サポート</p>
                  <p className="font-medium">03-1234-5678</p>
                  <p className="text-xs text-gray-500">平日 9:00-18:00</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
