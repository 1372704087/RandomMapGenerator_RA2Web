// 0x59b940 Blob_DirectedKey size=164

double __stdcall sub_59B940(__int16 *a1, __int16 *a2, _DWORD *a3, __int16 *a4, float a5, float a6)
{
  int v7; // ebp
  int v8; // ebx
  int v9; // edi
  unsigned int v10; // ecx
  __int64 v11; // rax
  int v12; // eax
  double result; // st7
  double v14; // st7
  signed int v15; // ecx
  __int64 v16; // rax
  double v17; // st7
  int v18; // eax
  int v19; // edx
  double v20; // [esp+10h] [ebp-8h]
  int v21; // [esp+1Ch] [ebp+4h]
  int v22; // [esp+20h] [ebp+8h]
  int v23; // [esp+24h] [ebp+Ch]
  int v24; // [esp+28h] [ebp+10h]

  if ( *a3 == dword_ABE2F0 && a3[1] == dword_ABE2F4 && a3[2] == dword_ABE2F8 && a3[3] == dword_ABE2FC )
  {
    v18 = *a1 - *a2;
    v19 = a1[1] - a2[1];
    result = (double)(v18 * v18 + v19 * v19);
    sub_4CAC40(result);
  }
  else
  {
    v7 = a4[1];
    v8 = *a2;
    v9 = a2[1];
    v22 = *a4;
    v10 = abs32(((v8 - v9) >> 1) - ((v22 - v7) >> 1));
    v23 = v10;
    v11 = ((v8 + v9) >> 1) - ((v7 + v22) >> 1);
    v12 = (HIDWORD(v11) ^ v11) - HIDWORD(v11);
    v24 = v12;
    if ( v10 != 0 || v12 != 0 )
    {
      v14 = (double)(int)(v10 * v10 + v12 * v12);
      sub_4CAC40(v14);
      v15 = abs32(a1[1] - a2[1]);
      v16 = *a1 - *a2;
      v21 = (HIDWORD(v16) ^ v16) - HIDWORD(v16);
      v20 = (double)v23 / v14;
      v17 = (double)v24 / v14;
      if ( v21 <= v15 )
        v21 = v15;
      return (v17 * a6 + a5 * v20) * (double)v21;
    }
    else
    {
      return 0.0;
    }
  }
  return result;
}
