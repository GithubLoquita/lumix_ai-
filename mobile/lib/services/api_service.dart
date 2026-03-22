import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiService {
  static const String baseUrl = 'https://ais-dev-ykx32ycne6xbzuyv7e244h-712667458188.asia-southeast1.run.app/api';

  Future<String?> removeBackground(String base64Image) async {
    final response = await http.post(
      Uri.parse('$baseUrl/ai/remove-bg'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'image': base64Image}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['image'];
    }
    return null;
  }

  Future<String?> enhancePhoto(String base64Image) async {
    final response = await http.post(
      Uri.parse('$baseUrl/ai/enhance'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'image': base64Image}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['image'];
    }
    return null;
  }

  Future<String?> generateImage(String prompt) async {
    final response = await http.post(
      Uri.parse('$baseUrl/ai/generate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'prompt': prompt}),
    );

    if (response.statusCode == 200) {
      return jsonDecode(response.body)['image'];
    }
    return null;
  }
}
